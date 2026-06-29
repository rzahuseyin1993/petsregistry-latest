import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPayPalOrderBody,
  createPayPalOrder,
  getPayPalAccessToken,
  resolvePayerEmail,
} from "./paypal.ts";
import { createAirwallexCheckout, getAirwallexConfig } from "./airwallex.ts";

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

    const { user_id, quantity = 1, provider = "airwallex" } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const qty = Math.max(1, Math.min(20, parseInt(String(quantity), 10) || 1));

    const { data: priceRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "service_price_certificate_one_time")
      .maybeSingle();
    const unitPrice = parseFloat(priceRow?.value || "15");
    const totalAmount = unitPrice * qty;

    const { data: pendingOrder, error: orderErr } = await supabase
      .from("certificate_credit_orders")
      .insert({
        user_id,
        quantity: qty,
        unit_price: unitPrice,
        total: totalAmount,
        status: "pending",
        payment_method: provider,
      })
      .select("id")
      .single();

    if (orderErr || !pendingOrder) {
      console.error("certificate_credit_orders insert:", orderErr);
      throw new Error("Could not create certificate order");
    }

    const orderId = pendingOrder.id as string;

    const cleanupOrder = async () => {
      await supabase.from("certificate_credit_orders").delete().eq("id", orderId);
    };

    const { data: settings } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("provider", provider)
      .eq("is_active", true)
      .maybeSingle();

    if (!settings?.secret_key) {
      await cleanupOrder();
      throw new Error(`${provider} is not configured. Admin must enable it in Payment Settings.`);
    }

    if (provider === "airwallex" && (!settings.publishable_key || !settings.secret_key)) {
      await cleanupOrder();
      throw new Error("Airwallex is not configured correctly. Admin must save Client ID and API Key in Payment Settings.");
    }
    if (provider === "stripe" && !settings.secret_key.trim().startsWith("sk_")) {
      await cleanupOrder();
      throw new Error("Stripe is not configured correctly. The admin must save a valid Stripe Secret Key (starts with sk_test_ or sk_live_) in Payment Settings.");
    }
    if (provider === "paypal" && (!settings.publishable_key || settings.publishable_key.length < 20)) {
      await cleanupOrder();
      throw new Error("PayPal is not configured correctly. The admin must save both PayPal Client ID and Secret in Payment Settings.");
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const returnBase = `${origin}/dashboard/certificates?credits_added=true&order_id=${orderId}`;
    const cancelUrl = `${origin}/dashboard/certificates?canceled=true&order_id=${orderId}`;

    if (provider === "airwallex") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", user_id)
        .maybeSingle();

      const awConfig = await getAirwallexConfig(supabase);
      const payerEmail = await resolvePayerEmail(supabase, user_id, profile?.email);
      const checkout = await createAirwallexCheckout({
        clientId: settings.publishable_key,
        apiKey: settings.secret_key,
        env: awConfig.env,
        loginAs: awConfig.loginAs,
        amount: totalAmount,
        merchantOrderId: `cert_${orderId}`,
        returnUrl: `${returnBase}&provider=airwallex`,
        cancelUrl,
        descriptor: "PetsRegistry Certificate",
        metadata: {
          type: "certificate_credit",
          user_id,
          quantity: String(qty),
          order_id: orderId,
        },
        customerEmail: payerEmail,
      });

      await supabase.from("certificate_credit_orders").update({
        payment_id: checkout.intent_id,
      }).eq("id", orderId);

      return new Response(JSON.stringify({ checkout, order_id: orderId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider === "stripe") {
      const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.secret_key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "payment",
          success_url: `${returnBase}&provider=stripe`,
          cancel_url: cancelUrl,
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(Math.round(unitPrice * 100)),
          "line_items[0][price_data][product_data][name]": `Pet Certificate Credit`,
          "line_items[0][quantity]": String(qty),
          "metadata[type]": "certificate_credit",
          "metadata[user_id]": user_id,
          "metadata[quantity]": String(qty),
          "metadata[order_id]": orderId,
        }),
      });
      const session = await res.json();
      if (session.error) {
        await cleanupOrder();
        throw new Error(session.error.message);
      }

      await supabase.from("certificate_credit_orders").update({
        payment_id: session.id,
      }).eq("id", orderId);

      return new Response(JSON.stringify({ url: session.url, order_id: orderId }), {
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

      const payerEmail = await resolvePayerEmail(supabase, user_id, profile?.email);

      const orderBody = buildPayPalOrderBody({
        returnUrl: `${returnBase}&provider=paypal`,
        cancelUrl,
        payerEmail,
        purchase_units: [{
          amount: { currency_code: "USD", value: totalAmount.toFixed(2) },
          description: `${qty} Pet Certificate Credit(s)`,
          custom_id: JSON.stringify({
            type: "certificate_credit",
            user_id,
            quantity: String(qty),
            order_id: orderId,
          }),
        }],
      });

      const { approvalUrl, id: paypalOrderId } = await createPayPalOrder(baseUrl, accessToken, orderBody);

      await supabase.from("certificate_credit_orders").update({
        payment_id: paypalOrderId,
      }).eq("id", orderId);

      return new Response(JSON.stringify({ url: approvalUrl, order_id: orderId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await cleanupOrder();
    throw new Error("Unsupported provider");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
