import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

type PaymentHandler = (
  supabase: ReturnType<typeof createClient>,
  metadata: Record<string, string>,
  paymentId: string,
) => Promise<void>;

async function activateMembership(
  supabase: ReturnType<typeof createClient>,
  metadata: Record<string, string>,
  paymentId: string,
) {
  const userId = metadata.user_id;
  const planId = metadata.plan_id;
  if (!userId || !planId) return;

  const billingInterval = metadata.billing_interval || "yearly";
  const durationDays = billingInterval === "monthly" ? 30 : billingInterval === "one_time" ? 36500 : 365;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("plan_id", planId)
    .eq("status", "active")
    .maybeSingle();

  if (!existing) {
    await supabase.from("memberships").insert({
      user_id: userId,
      plan_id: planId,
      status: "active",
      billing_interval: billingInterval,
      expires_at: expiresAt.toISOString(),
      payment_id: paymentId,
    });
  } else {
    await supabase.from("memberships").update({
      status: "active",
      billing_interval: billingInterval,
      expires_at: expiresAt.toISOString(),
      payment_id: paymentId,
    }).eq("id", existing.id);
  }
}

async function completeDonation(
  supabase: ReturnType<typeof createClient>,
  metadata: Record<string, string>,
  paymentId: string,
) {
  const donationId = metadata.donation_id;
  if (donationId) {
    await supabase.from("donations").update({
      status: "completed",
      payment_id: paymentId,
      payment_method: "airwallex",
    }).eq("id", donationId);
  } else {
    await supabase.from("donations").update({
      status: "completed",
      payment_method: "airwallex",
    }).eq("payment_id", paymentId);
  }
}

async function grantCertificateCredits(
  supabase: ReturnType<typeof createClient>,
  metadata: Record<string, string>,
  _paymentId: string,
) {
  const userId = metadata.user_id;
  const qty = parseInt(metadata.quantity || "1", 10);
  if (!userId || qty <= 0) return;

  await supabase.rpc("grant_certificate_credit", {
    _user_id: userId,
    _amount: qty,
    _is_purchase: true,
  });

  await supabase.from("admin_messages").insert({
    sender_id: userId,
    recipient_id: userId,
    subject: `Certificate Credits Purchased — ${qty} credit(s)`,
    message:
      `<p>Thank you! <strong>${qty} certificate credit(s)</strong> have been added to your account.</p><p>You can now create and issue ${qty} pet certificate(s) from your dashboard.</p>`,
    is_html: true,
  });
}

async function activateFlyerSubscription(
  supabase: ReturnType<typeof createClient>,
  metadata: Record<string, string>,
  paymentId: string,
) {
  const userId = metadata.user_id;
  if (!userId) return;

  const billingInterval = metadata.billing_interval || "yearly";
  const durationDays = billingInterval === "monthly" ? 30 : billingInterval === "one_time" ? 36500 : 365;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + durationDays);

  const { data: existing } = await supabase
    .from("flyer_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (existing) {
    await supabase.from("flyer_subscriptions").update({
      status: "active",
      expires_at: expiresAt.toISOString(),
    }).eq("id", existing.id);
    return;
  }

  const { data: pending } = await supabase
    .from("flyer_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending) {
    await supabase.from("flyer_subscriptions").update({
      status: "active",
      payment_id: paymentId,
      expires_at: expiresAt.toISOString(),
    }).eq("id", pending.id);
    return;
  }

  await supabase.from("flyer_subscriptions").insert({
    user_id: userId,
    status: "active",
    billing_interval: billingInterval,
    expires_at: expiresAt.toISOString(),
    payment_id: paymentId,
  });
}

const handlers: Record<string, PaymentHandler> = {
  membership: activateMembership,
  donation: completeDonation,
  certificate_credit: grantCertificateCredits,
  flyer_subscription: activateFlyerSubscription,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const event = await req.json();
    const eventName = event.name || event.type || "";
    console.log("Airwallex webhook:", eventName, event.id);

    if (!eventName.includes("payment_intent.succeeded") && eventName !== "payment_intent.succeeded") {
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intent = event.data?.object || event.data || {};
    const metadata = (intent.metadata || {}) as Record<string, string>;
    const paymentId = intent.id || event.id;
    const type = metadata.type;

    if (type && handlers[type]) {
      await handlers[type](supabase, metadata, paymentId);
    } else if (metadata.donation_id) {
      await completeDonation(supabase, metadata, paymentId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("airwallex-webhook error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
