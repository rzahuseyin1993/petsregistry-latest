import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPayPalOrderBody,
  createPayPalOrder,
  getBlockedPayPalEmails,
  getPayPalAccessToken,
  sanitizePayerEmail,
} from "./paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { planId, userId, billingInterval = "yearly", provider = "stripe" } = await req.json();

    if (!planId || !userId) {
      return new Response(JSON.stringify({ error: "Missing planId or userId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the plan
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("id", planId)
      .single();
    if (planErr || !plan) throw new Error("Plan not found");

    // Check for existing active membership for this plan
    const { data: existing } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("plan_id", planId)
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "You already have an active membership for this plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the requested gateway
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("is_active", true)
      .eq("provider", provider)
      .maybeSingle();

    // Get service pricing settings (shared by both gateways)
    const { data: pricingSettings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "yearly_discount_percent",
        "service_price_membership_monthly",
        "service_price_membership_yearly",
        "service_price_membership_one_time",
      ]);
    const settingsMap = Object.fromEntries((pricingSettings || []).map((s: any) => [s.key, s.value]));

    let price: number;
    const isOneTime = billingInterval === "one_time";

    if (billingInterval === "monthly") {
      const adminMonthly = settingsMap["service_price_membership_monthly"];
      price = adminMonthly ? Number(adminMonthly) : (plan.monthly_price && plan.monthly_price > 0
        ? plan.monthly_price
        : Math.ceil((plan.price / 12) * 100) / 100);
    } else if (isOneTime) {
      const adminOneTime = settingsMap["service_price_membership_one_time"];
      price = adminOneTime ? Number(adminOneTime) : plan.price;
    } else {
      const adminYearly = settingsMap["service_price_membership_yearly"];
      price = adminYearly ? Number(adminYearly) : plan.price;
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", userId)
      .single();

    // ─── STRIPE FLOW ────────────────────────────────────────
    if (provider === "stripe") {
      if (!paymentSettings?.secret_key) {
        return new Response(JSON.stringify({ error: "Stripe is not configured. Please ask the admin to enable it." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!paymentSettings.secret_key.trim().startsWith("sk_")) {
        return new Response(JSON.stringify({ error: "Stripe is not configured correctly. Admin must save a valid Stripe Secret Key (starts with sk_test_ or sk_live_) in Payment Settings." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const stripeKey = paymentSettings.secret_key;

      const params = new URLSearchParams({
        "mode": isOneTime ? "payment" : "subscription",
        "success_url": `${origin}/membership?success=true&plan=${planId}`,
        "cancel_url": `${origin}/membership?canceled=true`,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": String(Math.round(price * 100)),
        "line_items[0][price_data][product_data][name]": `${plan.name} (${billingInterval === "monthly" ? "Monthly" : billingInterval === "yearly" ? "Yearly" : "One-Time"})`,
        "line_items[0][quantity]": "1",
        "metadata[user_id]": userId,
        "metadata[plan_id]": planId,
        "metadata[type]": "membership",
        "metadata[billing_interval]": billingInterval,
      });

      if (!isOneTime) {
        params.set("line_items[0][price_data][recurring][interval]", billingInterval === "monthly" ? "month" : "year");
        params.set("subscription_data[metadata][user_id]", userId);
        params.set("subscription_data[metadata][plan_id]", planId);
        params.set("subscription_data[metadata][billing_interval]", billingInterval);
      }
      const blockedEmails = await getBlockedPayPalEmails(supabase);
      const stripeEmail = sanitizePayerEmail(profile?.email, blockedEmails);
      if (stripeEmail) params.set("customer_email", stripeEmail);

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      });
      const session = await stripeRes.json();
      if (session.error) {
        console.error("Stripe error:", session.error);
        throw new Error(session.error.message);
      }
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PAYPAL FLOW ────────────────────────────────────────
    if (provider === "paypal") {
      if (!paymentSettings?.publishable_key || !paymentSettings?.secret_key) {
        return new Response(JSON.stringify({ error: "PayPal is not configured. Admin must save both PayPal Client ID and Secret in Payment Settings." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (paymentSettings.publishable_key.length < 20 || paymentSettings.secret_key.length < 20) {
        return new Response(JSON.stringify({ error: "PayPal credentials look invalid. Admin must save the real Client ID and Secret from the PayPal Developer Dashboard." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const clientId = paymentSettings.publishable_key;
      const clientSecret = paymentSettings.secret_key;

      const { base: paypalBase, accessToken } = await getPayPalAccessToken(clientId, clientSecret);
      const blockedEmails = await getBlockedPayPalEmails(supabase);
      const payerEmail = sanitizePayerEmail(profile?.email, blockedEmails);

      const orderBody = buildPayPalOrderBody({
        returnUrl: `${origin}/membership?success=true&provider=paypal&plan=${planId}`,
        cancelUrl: `${origin}/membership?canceled=true`,
        payerEmail,
        purchase_units: [{
          reference_id: `membership_${planId}_${userId}`,
          description: `${plan.name} — ${billingInterval}`,
          custom_id: JSON.stringify({ user_id: userId, plan_id: planId, billing_interval: billingInterval, type: "membership" }),
          amount: {
            currency_code: "USD",
            value: price.toFixed(2),
          },
        }],
      });

      const { approvalUrl } = await createPayPalOrder(paypalBase, accessToken, orderBody);

      return new Response(JSON.stringify({ url: approvalUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error:
          "Unsupported or inactive payment provider. Choose Stripe or PayPal and ensure it is configured in Payment Settings.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("membership-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
