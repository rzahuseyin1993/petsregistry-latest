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
      const { base: baseUrl, accessToken } = await getPayPalAccessToken(settings.publishable_key, settings.secret_key);

      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();

      const blockedEmails = await getBlockedPayPalEmails(supabase);
      const payerEmail = sanitizePayerEmail(profile?.email, blockedEmails);

      const orderBody = buildPayPalOrderBody({
        returnUrl: `${origin}/dashboard/certificates?credits_added=true`,
        cancelUrl: `${origin}/dashboard/certificates?canceled=true`,
        payerEmail,
        purchase_units: [{
          amount: { currency_code: "USD", value: totalAmount.toFixed(2) },
          description: `${quantity} Pet Certificate Credit(s)`,
          custom_id: JSON.stringify({
            type: "certificate_credit",
            user_id,
            quantity: String(quantity),
          }),
        }],
      });

      const { approvalUrl } = await createPayPalOrder(baseUrl, accessToken, orderBody);

      return new Response(JSON.stringify({ url: approvalUrl }), {
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
