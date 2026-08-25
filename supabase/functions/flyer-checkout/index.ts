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

    const { billing_interval = "yearly", provider = "stripe" } = await req.json();

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "You must be signed in to purchase flyer access" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = authData.user.id;

    if (provider === "airwallex") {
      return new Response(JSON.stringify({ error: "Airwallex is no longer available. Please pay with Card (Stripe)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("secret_key, publishable_key")
      .eq("provider", "stripe")
      .eq("is_active", true)
      .maybeSingle();

    if (!paymentSettings?.secret_key?.trim().startsWith("sk_")) {
      return new Response(JSON.stringify({ error: "Stripe is not configured. Admin must save and activate Stripe in Payment Settings." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: profile } = await supabase
      .from("profiles").select("email").eq("user_id", user_id).maybeSingle();

    let origin = req.headers.get("origin") || "";
    if (!origin || origin.includes(".supabase.co")) {
      const { data: siteRow } = await supabase.from("site_settings").select("value").eq("key", "site_url").maybeSingle();
      origin = (siteRow?.value as string)?.trim() || "http://localhost:5173";
    }

    const durationDays = isOneTime ? 36500 : billing_interval === "monthly" ? 30 : 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const { data: pendingSub, error: pendingErr } = await supabase.from("flyer_subscriptions").insert({
      user_id,
      status: "pending",
      billing_interval,
      price,
      expires_at: expiresAt.toISOString(),
      payment_id: null,
    }).select("id").single();

    if (pendingErr || !pendingSub) {
      throw new Error("Could not start flyer checkout");
    }

    const params = new URLSearchParams({
      mode: isOneTime ? "payment" : "subscription",
      success_url: `${origin}/dashboard/flyer-builder?success=true&provider=stripe`,
      cancel_url: `${origin}/dashboard/flyer-builder?canceled=true`,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(Math.round(price * 100)),
      "line_items[0][price_data][product_data][name]": productName,
      "line_items[0][quantity]": "1",
      "metadata[type]": "flyer_subscription",
      "metadata[user_id]": user_id,
      "metadata[billing_interval]": billing_interval,
      "metadata[flyer_sub_id]": pendingSub.id,
    });

    if (!isOneTime) {
      params.set("line_items[0][price_data][recurring][interval]", billing_interval === "monthly" ? "month" : "year");
      params.set("subscription_data[metadata][type]", "flyer_subscription");
      params.set("subscription_data[metadata][user_id]", user_id);
      params.set("subscription_data[metadata][billing_interval]", billing_interval);
    }
    if (profile?.email) params.set("customer_email", profile.email);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paymentSettings.secret_key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await stripeRes.json();
    if (session.error || !session.url) {
      await supabase.from("flyer_subscriptions").delete().eq("id", pendingSub.id);
      throw new Error(session.error?.message || "Failed to create Stripe checkout");
    }

    await supabase.from("flyer_subscriptions").update({ payment_id: session.id }).eq("id", pendingSub.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("flyer-checkout error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
