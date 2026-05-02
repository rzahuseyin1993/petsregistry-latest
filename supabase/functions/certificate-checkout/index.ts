import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { user_id, quantity = 1, provider = "stripe" } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    // Get price per credit
    const { data: priceRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "service_price_certificate_one_time")
      .maybeSingle();
    const unitPrice = parseFloat(priceRow?.value || "15");
    const totalAmount = unitPrice * quantity;

    const { data: settings } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("provider", provider)
      .eq("is_active", true)
      .maybeSingle();

    if (!settings?.secret_key) throw new Error(`${provider} is not configured. Admin must enable it in Payment Settings.`);

    if (provider === "stripe" && !settings.secret_key.trim().startsWith("sk_")) {
      throw new Error("Stripe is not configured correctly. The admin must save a valid Stripe Secret Key (starts with sk_test_ or sk_live_) in Payment Settings.");
    }
    if (provider === "paypal" && (!settings.publishable_key || settings.publishable_key.length < 20)) {
      throw new Error("PayPal is not configured correctly. The admin must save both PayPal Client ID and Secret in Payment Settings.");
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";

    if (provider === "stripe") {
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "payment",
          success_url: `${origin}/dashboard/certificates?credits_added=true`,
          cancel_url: `${origin}/dashboard/certificates?canceled=true`,
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(Math.round(unitPrice * 100)),
          "line_items[0][price_data][product_data][name]": `Pet Certificate Credit`,
          "line_items[0][quantity]": String(quantity),
          "metadata[type]": "certificate_credit",
          "metadata[user_id]": user_id,
          "metadata[quantity]": String(quantity),
        }),
      });
      const session = await res.json();
      if (session.error) throw new Error(session.error.message);
      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider === "paypal") {
      const isSandbox = settings.secret_key.includes("sandbox") || settings.publishable_key?.includes("sandbox");
      const baseUrl = isSandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
      const auth = btoa(`${settings.publishable_key}:${settings.secret_key}`);
      const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      const { access_token } = await tokenRes.json();

      const orderRes = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: { currency_code: "USD", value: totalAmount.toFixed(2) },
            description: `${quantity} Pet Certificate Credit(s)`,
            custom_id: JSON.stringify({
              type: "certificate_credit",
              user_id,
              quantity: String(quantity),
            }),
          }],
          application_context: {
            return_url: `${origin}/dashboard/certificates?credits_added=true`,
            cancel_url: `${origin}/dashboard/certificates?canceled=true`,
          },
        }),
      });
      const order = await orderRes.json();
      const approvalLink = order.links?.find((l: any) => l.rel === "approve")?.href;
      if (!approvalLink) throw new Error("PayPal approval URL not returned");
      return new Response(JSON.stringify({ url: approvalLink }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unsupported provider");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
