import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPayPalOrderBody,
  createPayPalOrder,
  getPayPalAccessToken,
  resolvePayerEmail,
  buildPayPalCustomId,
  sanitizePayPalDescription,
} from "./paypal.ts";
import { createAirwallexCheckout, resolveAirwallexConfig } from "./airwallex.ts";

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

    const { amount, donorName, donorEmail, packageId, message, provider = "airwallex", returnPath } = await req.json();

    if (!amount || amount <= 0 || amount > 100000) throw new Error("Invalid donation amount");

    // Derive the user from the JWT instead of trusting a client-supplied id
    // (donations from anonymous visitors simply have no user attached).
    let userId: string | null = null;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id ?? null;
    }

    // Get the requested gateway
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("is_active", true)
      .eq("provider", provider)
      .maybeSingle();

    const origin = req.headers.get("origin") || "http://localhost:5173";
    const donatePath = typeof returnPath === "string" && returnPath.startsWith("/") ? returnPath : "/dashboard/donate";

    const { data: pendingDonation, error: pendingErr } = await supabase
      .from("donations")
      .insert({
        amount,
        donor_name: donorName || null,
        donor_email: donorEmail || null,
        user_id: userId || null,
        package_id: packageId || null,
        message: message || null,
        payment_method: provider,
        payment_id: null,
        status: "pending",
      })
      .select("id")
      .single();

    if (pendingErr || !pendingDonation) {
      console.error("donation pending insert:", pendingErr);
      throw new Error("Could not start donation checkout");
    }

    const donationRowId = pendingDonation.id as string;

    // ─── AIRWALLEX FLOW ─────────────────────────────────────
    if (provider === "airwallex") {
      const awConfig = await resolveAirwallexConfig(supabase);
      if (!awConfig) {
        await supabase.from("donations").delete().eq("id", donationRowId);
        return new Response(JSON.stringify({ error: "Airwallex is not configured. Admin must save and enable Demo or Live credentials in Payment Settings." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payerEmail = await resolvePayerEmail(supabase, userId, null, donorEmail);
      const checkout = await createAirwallexCheckout({
        clientId: awConfig.clientId,
        apiKey: awConfig.apiKey,
        env: awConfig.env,
        loginAs: awConfig.loginAs,
        amount: Number(amount),
        merchantOrderId: `donation_${donationRowId}`,
        returnUrl: `${origin}${donatePath}?success=true&provider=airwallex`,
        cancelUrl: `${origin}${donatePath}?canceled=true`,
        descriptor: "PetsRegistry Donation",
        metadata: {
          type: "donation",
          donation_id: donationRowId,
          user_id: userId || "",
          package_id: packageId || "",
        },
        customerEmail: payerEmail,
      });

      await supabase.from("donations").update({ payment_id: checkout.intent_id }).eq("id", donationRowId);

      return new Response(JSON.stringify({ checkout }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── STRIPE FLOW (disabled in admin UI — kept for future use) ───
    if (provider === "stripe") {
      if (!paymentSettings?.secret_key || !paymentSettings.secret_key.trim().startsWith("sk_")) {
        await supabase.from("donations").delete().eq("id", donationRowId);
        return new Response(JSON.stringify({ error: "Stripe is not configured. Admin must save a valid Stripe Secret Key (starts with sk_) in Payment Settings." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paymentSettings.secret_key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "mode": "payment",
          "success_url": `${origin}${donatePath}?success=true`,
          "cancel_url": `${origin}${donatePath}?canceled=true`,
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
          "line_items[0][price_data][product_data][name]": `Donation to PetsRegistry`,
          "line_items[0][price_data][product_data][description]": message || "Thank you for your generous donation!",
          "line_items[0][quantity]": "1",
          "metadata[type]": "donation",
          "metadata[donation_id]": donationRowId,
          "metadata[user_id]": userId || "",
          "metadata[package_id]": packageId || "",
          "metadata[donor_name]": donorName || "",
          "metadata[donor_email]": donorEmail || "",
          "metadata[message]": message || "",
          "submit_type": "donate",
        }),
      });

      const session = await stripeRes.json();
      if (session.error) {
        console.error("Stripe error:", session.error);
        await supabase.from("donations").delete().eq("id", donationRowId);
        throw new Error(session.error.message);
      }

      await supabase.from("donations").update({ payment_id: session.id }).eq("id", donationRowId);

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── PAYPAL FLOW ────────────────────────────────────────
    if (provider === "paypal") {
      if (!paymentSettings?.publishable_key || !paymentSettings?.secret_key) {
        await supabase.from("donations").delete().eq("id", donationRowId);
        return new Response(JSON.stringify({ error: "PayPal is not configured. Admin must save Client ID and Secret in Payment Settings." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const clientId = paymentSettings.publishable_key;
      const clientSecret = paymentSettings.secret_key;

      let paypalBase = "";
      let accessToken = "";
      try {
        const token = await getPayPalAccessToken(clientId, clientSecret);
        paypalBase = token.base;
        accessToken = token.accessToken;
      } catch (tokenErr) {
        console.error("PayPal token error:", tokenErr);
        await supabase.from("donations").delete().eq("id", donationRowId);
        throw tokenErr;
      }

      const payerEmail = await resolvePayerEmail(supabase, userId, null, donorEmail);

      const orderBody = buildPayPalOrderBody({
        returnUrl: `${origin}${donatePath}?success=true&provider=paypal`,
        cancelUrl: `${origin}${donatePath}?canceled=true`,
        payerEmail,
        purchase_units: [{
          reference_id: `donation_${donationRowId}`.slice(0, 127),
          description: sanitizePayPalDescription(
            `Donation to PetsRegistry${message ? ` — ${message}` : ""}`,
          ),
          custom_id: buildPayPalCustomId({
            type: "donation",
            donation_id: donationRowId,
            user_id: userId || undefined,
            package_id: packageId || undefined,
          }),
          amount: { currency_code: "USD", value: Number(amount).toFixed(2) },
        }],
      });

      const { id: orderId, approvalUrl } = await createPayPalOrder(paypalBase, accessToken, orderBody);

      await supabase.from("donations").update({ payment_id: orderId }).eq("id", donationRowId);

      return new Response(JSON.stringify({ url: approvalUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("donations").delete().eq("id", donationRowId);
    return new Response(JSON.stringify({ error: "Unsupported payment provider" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("donation-checkout error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
