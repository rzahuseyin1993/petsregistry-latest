import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, billing_interval = "yearly" } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has active access
    const { data: existing } = await supabase
      .from("flyer_subscriptions")
      .select("id")
      .eq("user_id", user_id)
      .eq("status", "active")
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "You already have active flyer access." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Stripe keys
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("secret_key, publishable_key")
      .eq("provider", "stripe")
      .eq("is_active", true)
      .single();

    if (!paymentSettings?.secret_key) {
      return new Response(JSON.stringify({ error: "Stripe is not configured. Please contact admin." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paymentSettings.secret_key.trim().startsWith("sk_")) {
      return new Response(JSON.stringify({ error: "Stripe secret key is invalid. Please save an sk_ key in Payment Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pricing from site_settings
    const { data: pricingSettings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "flyer_monthly_price", "flyer_yearly_price",
        "service_price_flyer_monthly", "service_price_flyer_yearly", "service_price_flyer_one_time",
        "service_billing_flyer",
      ]);
    const settingsMap = Object.fromEntries((pricingSettings || []).map((s: any) => [s.key, s.value]));

    const monthlyPrice = Number(settingsMap["service_price_flyer_monthly"] || settingsMap["flyer_monthly_price"] || 1);
    const yearlyPrice = Number(settingsMap["service_price_flyer_yearly"] || settingsMap["flyer_yearly_price"] || 10);
    const oneTimePrice = Number(settingsMap["service_price_flyer_one_time"] || 5);

    const isOneTime = billing_interval === "one_time";
    let price: number;
    let productName: string;

    if (isOneTime) {
      price = oneTimePrice;
      productName = "Lost Pet Flyer Builder (One-Time)";
    } else if (billing_interval === "monthly") {
      price = monthlyPrice;
      productName = "Lost Pet Flyer Builder (Monthly)";
    } else {
      price = yearlyPrice;
      productName = "Lost Pet Flyer Builder (Yearly)";
    }

    // Get user email
    const { data: profile } = await supabase
      .from("profiles").select("email").eq("user_id", user_id).single();

    let origin = req.headers.get("origin") || "";
    if (!origin || origin.includes(".supabase.co")) {
      const { data: siteRow } = await supabase.from("site_settings").select("value").eq("key", "site_url").maybeSingle();
      origin = (siteRow?.value as string)?.trim() || "http://localhost:5173";
    }

    const params = new URLSearchParams({
      "mode": isOneTime ? "payment" : "subscription",
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(price * 100)),
      "line_items[0][price_data][product_data][name]": productName,
      "line_items[0][quantity]": "1",
      "success_url": `${origin}/dashboard/flyer-builder?success=true`,
      "cancel_url": `${origin}/dashboard/flyer-builder?canceled=true`,
      "metadata[user_id]": user_id,
      "metadata[type]": "flyer_subscription",
      "metadata[billing_interval]": billing_interval,
    });

    if (!isOneTime) {
      params.set("line_items[0][price_data][recurring][interval]", billing_interval === "monthly" ? "month" : "year");
      params.set("subscription_data[metadata][user_id]", user_id);
      params.set("subscription_data[metadata][type]", "flyer_subscription");
      params.set("subscription_data[metadata][billing_interval]", billing_interval);
    }

    if (profile?.email) {
      params.set("customer_email", profile.email);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paymentSettings.secret_key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error("Stripe error:", session);
      return new Response(JSON.stringify({ error: "Failed to create checkout session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert subscription record
    const durationDays = isOneTime ? 36500 : billing_interval === "monthly" ? 30 : 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await supabase.from("flyer_subscriptions").insert({
      user_id,
      status: "active",
      billing_interval,
      price,
      expires_at: expiresAt.toISOString(),
      payment_id: session.id,
      stripe_subscription_id: session.subscription || null,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
