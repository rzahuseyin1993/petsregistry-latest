import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPayPalOrderBody,
  createPayPalOrder,
  getPayPalAccessToken,
  resolvePayerEmail,
} from "./paypal.ts";

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
  const universal = (() => {
    switch (product) {
      case "bundle":
        return qty * 2;
      case "ownership_pack_10":
      case "birth_pack_10":
      case "reseller_mixed_pack_10":
        return 10 * qty;
      default:
        return qty;
    }
  })();
  return { ownership: universal, birth: 0 };
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
    ownership: "Certificate Credit",
    birth: "Certificate Credit",
    bundle: "2 Certificate Credits",
    ownership_pack_10: "Certificate Pack (10)",
    birth_pack_10: "Certificate Pack (10)",
    reseller_mixed_pack_10: "Reseller Pack (10)",
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

    const body = await req.json();
    const quantity = body.quantity ?? 1;
    const provider = typeof body.provider === "string" ? body.provider.trim() : "stripe";
    const credit_type = body.credit_type ?? "ownership";
    const testOnly = body.test_only === true || body.test_only === "true" || body.testOnly === true;

    // Derive the user from the JWT — never trust a client-supplied user id for payments
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: authData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: "You must be signed in to buy certificate credits" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user_id = authData.user.id;

    // Dry credential check for the admin "Test Connection" button.
    if (testOnly) {
      const { data: testSettings } = await supabase
        .from("payment_settings")
        .select("*")
        .eq("provider", provider)
        .eq("is_active", true)
        .maybeSingle();

      if (!testSettings?.secret_key) {
        throw new Error(`${provider} is not configured or not active. Save and activate it in Payment Settings first.`);
      }

      if (provider === "paypal") {
        await getPayPalAccessToken(testSettings.publishable_key, testSettings.secret_key);
      } else if (provider === "stripe") {
        const res = await fetch("https://api.stripe.com/v1/balance", {
          headers: { Authorization: `Bearer ${testSettings.secret_key}` },
        });
        if (!res.ok) {
          const bodyJson = await res.json().catch(() => ({}));
          throw new Error(bodyJson?.error?.message || "Stripe credentials are invalid.");
        }
      } else if (provider === "airwallex" || provider.startsWith("airwallex_")) {
        throw new Error("Airwallex is no longer available for this project.");
      } else {
        throw new Error("Unsupported provider");
      }

      return new Response(JSON.stringify({ ok: true, test: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    if (provider === "airwallex" || provider.startsWith("airwallex_")) {
      await cleanupOrder();
      throw new Error("Airwallex is no longer available. Please pay with Card (Stripe) or PayPal.");
    }

    if (!settings?.secret_key) {
      await cleanupOrder();
      throw new Error(`${provider} is not configured. Admin must enable it in Payment Settings.`);
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
