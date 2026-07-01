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

type CreditProductType =
  | "ownership"
  | "birth"
  | "bundle"
  | "ownership_pack_10"
  | "birth_pack_10"
  | "reseller_mixed_pack_10";

function productQuantities(product: CreditProductType, qty: number) {
  switch (product) {
    case "birth":
      return { ownership: 0, birth: qty };
    case "bundle":
      return { ownership: qty, birth: qty };
    case "ownership_pack_10":
      return { ownership: 10 * qty, birth: 0 };
    case "birth_pack_10":
      return { ownership: 0, birth: 10 * qty };
    case "reseller_mixed_pack_10":
      return { ownership: 5 * qty, birth: 5 * qty };
    default:
      return { ownership: qty, birth: 0 };
  }
}

function priceKeyForProduct(product: CreditProductType): string {
  const map: Record<CreditProductType, string> = {
    ownership: "service_price_certificate_ownership",
    birth: "service_price_certificate_birth",
    bundle: "service_price_certificate_bundle",
    ownership_pack_10: "service_price_certificate_ownership_pack_10",
    birth_pack_10: "service_price_certificate_birth_pack_10",
    reseller_mixed_pack_10: "service_price_certificate_reseller_mixed_pack_10",
  };
  return map[product] || "service_price_certificate_one_time";
}

function defaultPrice(product: CreditProductType): number {
  const map: Record<CreditProductType, number> = {
    ownership: 15,
    birth: 15,
    bundle: 30,
    ownership_pack_10: 120,
    birth_pack_10: 120,
    reseller_mixed_pack_10: 120,
  };
  return map[product] ?? 15;
}

function productLabel(product: CreditProductType): string {
  const labels: Record<CreditProductType, string> = {
    ownership: "Ownership Certificate Credit",
    birth: "Birth Certificate Credit",
    bundle: "Ownership + Birth Bundle",
    ownership_pack_10: "Ownership Pack (10)",
    birth_pack_10: "Birth Pack (10)",
    reseller_mixed_pack_10: "Reseller Mixed Pack (5+5)",
  };
  return labels[product] || "Certificate Credit";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      user_id,
      quantity = 1,
      provider = "airwallex",
      credit_type = "ownership",
    } = await req.json();
    if (!user_id) throw new Error("user_id is required");

    const product = String(credit_type) as CreditProductType;
    const qty = Math.max(1, Math.min(20, parseInt(String(quantity), 10) || 1));

    if (product === "reseller_mixed_pack_10" || product === "ownership_pack_10" || product === "birth_pack_10") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_certificate_reseller")
        .eq("user_id", user_id)
        .maybeSingle();
      if (!profile?.is_certificate_reseller) {
        throw new Error("Reseller packs require a shop/reseller account. Contact support to enable.");
      }
    }

    const { data: priceRow } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", priceKeyForProduct(product))
      .maybeSingle();

    let unitPrice = parseFloat(priceRow?.value || String(defaultPrice(product)));
    if (Number.isNaN(unitPrice) || unitPrice <= 0) {
      const { data: fallback } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "service_price_certificate_one_time")
        .maybeSingle();
      unitPrice = parseFloat(fallback?.value || "15");
    }

    const totalAmount = unitPrice * qty;
    const { ownership, birth } = productQuantities(product, qty);
    const displayQty = ownership + birth > 0 ? Math.max(ownership, birth, qty) : qty;

    const { data: pendingOrder, error: orderErr } = await supabase
      .from("certificate_credit_orders")
      .insert({
        user_id,
        quantity: displayQty,
        unit_price: unitPrice,
        total: totalAmount,
        status: "pending",
        payment_method: provider,
        credit_type: product,
        ownership_qty: ownership,
        birth_qty: birth,
      })
      .select("id")
      .single();

    if (orderErr || !pendingOrder) {
      console.error("certificate_credit_orders insert:", orderErr);
      throw new Error("Could not create certificate order");
    }

    const orderId = pendingOrder.id as string;
    const label = productLabel(product);

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
          credit_type: product,
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
          "line_items[0][price_data][product_data][name]": label,
          "line_items[0][quantity]": String(qty),
          "metadata[type]": "certificate_credit",
          "metadata[credit_type]": product,
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
          description: `${qty} × ${label}`,
          custom_id: JSON.stringify({
            type: "certificate_credit",
            credit_type: product,
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
