import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAirwallexCheckout, getAirwallexConfig } from "./airwallex.ts";

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
      .eq("provider", "airwallex")
      .eq("is_active", true)
      .maybeSingle();

    if (!paymentSettings?.publishable_key || !paymentSettings?.secret_key) {
      return new Response(JSON.stringify({ error: "Airwallex is not configured. Please contact admin." }), {
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

    const awConfig = await getAirwallexConfig(supabase);
    const checkout = await createAirwallexCheckout({
      clientId: paymentSettings.publishable_key,
      apiKey: paymentSettings.secret_key,
      env: awConfig.env,
      loginAs: awConfig.loginAs,
      amount: price,
      merchantOrderId: `flyer_${user_id}_${Date.now()}`,
      returnUrl: `${origin}/dashboard/flyer-builder?success=true&provider=airwallex`,
      cancelUrl: `${origin}/dashboard/flyer-builder?canceled=true`,
      descriptor: productName.slice(0, 32),
      metadata: {
        type: "flyer_subscription",
        user_id,
        billing_interval,
      },
      customerEmail: profile?.email || null,
    });

    const durationDays = isOneTime ? 36500 : billing_interval === "monthly" ? 30 : 365;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await supabase.from("flyer_subscriptions").insert({
      user_id,
      status: "pending",
      billing_interval,
      price,
      expires_at: expiresAt.toISOString(),
      payment_id: checkout.intent_id,
    });

    return new Response(JSON.stringify({ checkout }), {
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
