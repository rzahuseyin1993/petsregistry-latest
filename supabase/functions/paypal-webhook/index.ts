import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-transmission-sig, paypal-cert-url, paypal-auth-algo",
};

/**
 * PayPal webhook handler.
 *
 * Configure PayPal in the developer dashboard to send these event types to:
 *   https://<project-ref>.functions.supabase.co/paypal-webhook
 *
 * Subscribed events:
 *   - PAYMENT.CAPTURE.COMPLETED         (one-time payments / order captures)
 *   - CHECKOUT.ORDER.APPROVED           (backup for capture)
 *   - BILLING.SUBSCRIPTION.ACTIVATED    (subscription activation)
 *   - BILLING.SUBSCRIPTION.CANCELLED    (subscription cancellation)
 *
 * The originating checkout edge functions must include a `custom_id` (or
 * `purchase_units[0].custom_id`) JSON-stringified payload of the form:
 *   { user_id, type, ...metadata }
 *
 * Where `type` is one of:
 *   - "membership"          → activates a membership row
 *   - "certificate_credit"  → grants N credits via grant_certificate_credit RPC
 *   - "donation"            → marks the matching donation row as "completed"
 *   - "store_order"         → marks the order paid + deducts stock
 *   - "flyer_subscription"  → activates flyer subscription
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const event = await req.json();
    console.log("PayPal webhook event:", event.event_type, "id:", event.id);

    const resource = event.resource || {};

    // --- Helper: extract our metadata from the PayPal resource ---
    const extractMetadata = (): Record<string, any> => {
      // 1) capture or order resource
      let raw =
        resource.custom_id ||
        resource.custom ||
        resource?.purchase_units?.[0]?.custom_id ||
        resource?.supplementary_data?.related_ids?.order_id ||
        null;

      // For subscriptions PayPal puts custom_id on the plan / subscription
      if (!raw && resource.subscriber) {
        raw = resource.custom_id || resource?.plan_overridden?.custom_id;
      }

      if (!raw) return {};
      try {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        // Treat as a plain payment_id reference
        return { payment_id: String(raw) };
      }
    };

    const metadata = extractMetadata();
    const paymentId = resource.id || event.id;
    const userId = metadata.user_id;
    const type = metadata.type;

    console.log("Parsed metadata:", { type, userId, paymentId });

    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
      case "CHECKOUT.ORDER.APPROVED": {
        if (!type) {
          // Fallback: try to find a pending donation/order by its payment_id
          if (paymentId) {
            await supabase.from("donations").update({ status: "completed" }).eq("payment_id", paymentId);
            await supabase.from("orders").update({ status: "paid" }).eq("payment_id", paymentId);
          }
          break;
        }

        if (!userId && type !== "donation") break;

        if (type === "membership") {
          const planId = metadata.plan_id;
          const billingInterval = metadata.billing_interval || "yearly";
          const durationDays = billingInterval === "monthly" ? 30 : 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);

          const { data: existing } = await supabase
            .from("memberships")
            .select("id")
            .eq("user_id", userId)
            .eq("plan_id", planId)
            .eq("status", "active")
            .maybeSingle();

          if (!existing) {
            await supabase.from("memberships").insert({
              user_id: userId,
              plan_id: planId,
              status: "active",
              billing_interval: billingInterval,
              expires_at: expiresAt.toISOString(),
              payment_id: paymentId,
            });
          } else {
            await supabase.from("memberships").update({
              status: "active",
              expires_at: expiresAt.toISOString(),
              payment_id: paymentId,
            }).eq("id", existing.id);
          }
        } else if (type === "certificate_credit") {
          const qty = parseInt(metadata.quantity || "1");
          await supabase.rpc("grant_certificate_credit", {
            _user_id: userId,
            _amount: qty,
            _is_purchase: true,
          });
          await supabase.from("admin_messages").insert({
            sender_id: userId,
            recipient_id: userId,
            subject: `Certificate Credits Purchased — ${qty} credit(s)`,
            message: `<p>Thank you! <strong>${qty} certificate credit(s)</strong> have been added to your account via PayPal.</p>`,
            is_html: true,
          });
        } else if (type === "donation") {
          const donationId = metadata.donation_id;
          const orderIdFromCapture = (resource as any)?.supplementary_data?.related_ids?.order_id as
            | string
            | undefined;
          if (donationId) {
            await supabase.from("donations").update({
              status: "completed",
              payment_id: orderIdFromCapture || paymentId,
              payment_method: "paypal",
            }).eq("id", donationId);
          } else if (orderIdFromCapture) {
            await supabase.from("donations").update({
              status: "completed",
              payment_method: "paypal",
            }).eq("payment_id", orderIdFromCapture);
          } else if (paymentId) {
            await supabase.from("donations").update({ status: "completed", payment_method: "paypal" }).eq(
              "payment_id",
              paymentId,
            );
          }
        } else if (type === "store_order") {
          const orderId = metadata.order_id;
          if (!orderId) break;

          await supabase.from("orders").update({
            status: "paid",
            payment_id: paymentId,
            payment_method: "paypal",
          }).eq("id", orderId);

          // Deduct stock
          const { data: items } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", orderId);

          for (const item of items || []) {
            await supabase.rpc("deduct_stock", {
              _product_id: item.product_id,
              _quantity: item.quantity,
            });
          }

          await supabase.from("admin_messages").insert({
            sender_id: userId,
            recipient_id: userId,
            subject: "Order Confirmed",
            message: `<p>Thank you for your purchase! Your order has been received and payment confirmed via PayPal.</p>`,
            is_html: true,
          });
        } else if (type === "flyer_subscription") {
          const billingInterval = metadata.billing_interval || "one_time";
          const durationDays = billingInterval === "monthly" ? 30 : 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);

          await supabase.from("flyer_subscriptions").upsert({
            user_id: userId,
            status: "active",
            billing_interval: billingInterval,
            expires_at: expiresAt.toISOString(),
            payment_id: paymentId,
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        // PayPal subscription activated — handled the same as a one-off membership grant
        if (type === "membership" && userId) {
          const planId = metadata.plan_id;
          const billingInterval = metadata.billing_interval || "monthly";
          const durationDays = billingInterval === "monthly" ? 30 : 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);

          await supabase.from("memberships").upsert({
            user_id: userId,
            plan_id: planId,
            status: "active",
            billing_interval: billingInterval,
            expires_at: expiresAt.toISOString(),
            payment_id: resource.id,
          }, { onConflict: "user_id,plan_id" });
        }
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subId = resource.id;
        if (subId) {
          await supabase.from("memberships").update({ status: "canceled" }).eq("payment_id", subId);
          await supabase.from("flyer_subscriptions").update({ status: "canceled" }).eq("payment_id", subId);
        }
        break;
      }

      default:
        console.log("Unhandled PayPal event:", event.event_type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("PayPal webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
