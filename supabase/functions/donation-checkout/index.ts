import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getPayPalAccessToken = async (clientId: string, clientSecret: string) => {
  const auth = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  const bases = ["https://api-m.sandbox.paypal.com", "https://api-m.paypal.com"];
  let lastError: any = null;

  for (const base of bases) {
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (tokenRes.ok && tokenData.access_token) {
      return { base, accessToken: tokenData.access_token as string };
    }
    lastError = tokenData;
  }

  throw new Error(lastError?.error_description || "Failed to authenticate with PayPal");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { amount, donorName, donorEmail, userId, packageId, message, provider = "stripe" } = await req.json();

    if (!amount || amount <= 0) throw new Error("Invalid donation amount");

    // Get the requested gateway
    const { data: paymentSettings } = await supabase
      .from("payment_settings")
      .select("*")
      .eq("is_active", true)
      .eq("provider", provider)
      .maybeSingle();

    const origin = req.headers.get("origin") || "http://localhost:5173";

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

    // ─── STRIPE FLOW ────────────────────────────────────────
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
          "success_url": `${origin}/donate?success=true`,
          "cancel_url": `${origin}/donate?canceled=true`,
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

      const orderRes = await fetch(`${paypalBase}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            reference_id: `donation_${userId || "guest"}_${Date.now()}`,
            description: `Donation to PetsRegistry${message ? " — " + message.slice(0, 80) : ""}`,
            custom_id: JSON.stringify({
              donation_id: donationRowId,
              user_id: userId || null,
              package_id: packageId || null,
              type: "donation",
              donor_name: donorName || null,
              donor_email: donorEmail || null,
              message: message || null,
            }),
            amount: { currency_code: "USD", value: Number(amount).toFixed(2) },
          }],
          application_context: {
            return_url: `${origin}/donate?success=true&provider=paypal`,
            cancel_url: `${origin}/donate?canceled=true`,
            brand_name: "PetsRegistry",
            user_action: "PAY_NOW",
          },
        }),
      });
      const orderData = await orderRes.json();
      if (!orderData.id) {
        console.error("PayPal order error:", orderData);
        await supabase.from("donations").delete().eq("id", donationRowId);
        throw new Error(orderData.message || "Failed to create PayPal order");
      }
      const approvalLink = orderData.links?.find((l: any) => l.rel === "approve")?.href;
      if (!approvalLink) {
        console.error("PayPal order missing approval link:", orderData);
        await supabase.from("donations").delete().eq("id", donationRowId);
        throw new Error(orderData?.message || orderData?.details?.[0]?.description || "PayPal did not return an approval link");
      }

      await supabase.from("donations").update({ payment_id: orderData.id }).eq("id", donationRowId);

      return new Response(JSON.stringify({ url: approvalLink }), {
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
