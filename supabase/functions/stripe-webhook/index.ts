import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const event = body;

    console.log("Stripe webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const type = metadata.type;

        // Donations (guest checkout has no user_id — must run before userId guard)
        if (type === "donation") {
          const donationId = metadata.donation_id;
          if (donationId) {
            await supabase.from("donations").update({
              status: "completed",
              payment_id: session.id,
              payment_method: "stripe",
            }).eq("id", donationId);
          } else {
            await supabase.from("donations").update({
              status: "completed",
              payment_method: "stripe",
            }).eq("payment_id", session.id);
          }
          break;
        }

        const userId = metadata.user_id;
        const billingInterval = metadata.billing_interval || "yearly";
        const subscriptionId = session.subscription;
        const customerId = session.customer;

        if (!userId) break;

        if (type === "membership") {
          const planId = metadata.plan_id;
          const durationDays = billingInterval === "monthly" ? 30 : 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);

          // Check if membership already exists (created by fallback)
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
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              expires_at: expiresAt.toISOString(),
              payment_id: session.id,
            });
          } else {
            await supabase.from("memberships").update({
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              payment_id: session.id,
            }).eq("id", existing.id);
          }
        } else if (type === "flyer_subscription") {
          // Update existing flyer subscription with Stripe IDs
          await supabase
            .from("flyer_subscriptions")
            .update({
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
            })
            .eq("user_id", userId)
            .eq("payment_id", session.id);
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
            message: `<p>Thank you! <strong>${qty} certificate credit(s)</strong> have been added to your account.</p><p>You can now create and issue ${qty} pet certificate(s) from your dashboard.</p>`,
            is_html: true,
          });
        }
        break;
      }

      case "invoice.paid": {
        // Subscription renewed
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        // Renew membership
        const { data: membership } = await supabase
          .from("memberships")
          .select("*")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (membership) {
          const durationDays = membership.billing_interval === "monthly" ? 30 : 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);
          await supabase.from("memberships").update({
            status: "active",
            expires_at: expiresAt.toISOString(),
          }).eq("id", membership.id);
        }

        // Renew flyer subscription
        const { data: flyerSub } = await supabase
          .from("flyer_subscriptions")
          .select("*")
          .eq("stripe_subscription_id", subscriptionId)
          .maybeSingle();

        if (flyerSub) {
          const durationDays = flyerSub.billing_interval === "monthly" ? 30 : 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + durationDays);
          await supabase.from("flyer_subscriptions").update({
            status: "active",
            expires_at: expiresAt.toISOString(),
          }).eq("id", flyerSub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        // Cancel membership
        await supabase
          .from("memberships")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscriptionId);

        // Cancel flyer subscription
        await supabase
          .from("flyer_subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscriptionId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        if (subscription.status === "past_due" || subscription.status === "unpaid") {
          await supabase
            .from("memberships")
            .update({ status: "expired" })
            .eq("stripe_subscription_id", subscriptionId);
          await supabase
            .from("flyer_subscriptions")
            .update({ status: "expired" })
            .eq("stripe_subscription_id", subscriptionId);
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
