import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getAirwallexAccessToken,
  getAirwallexApiBase,
  getAirwallexConfig,
} from "../certificate-checkout/airwallex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendCreditsMessage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  qty: number,
  provider: string,
) {
  await supabase.from("admin_messages").insert({
    sender_id: userId,
    recipient_id: userId,
    subject: `Certificate Credits Purchased — ${qty} credit(s)`,
    message: `<p>Thank you! <strong>${qty} certificate credit(s)</strong> have been added to your account.</p><p>Payment via ${provider}. You can now issue pet certificates from your dashboard.</p>`,
    is_html: true,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = await req.json();
    if (!order_id) throw new Error("order_id is required");

    const { data: order, error: orderErr } = await supabase
      .from("certificate_credit_orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) throw new Error("Order not found");
    if (order.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.credits_granted) {
      return new Response(JSON.stringify({
        status: "paid",
        quantity: order.quantity,
        credits_granted: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let shouldFulfill = false;
    const provider = order.payment_method || "unknown";

    if (order.payment_method === "airwallex" && order.payment_id) {
      const { data: settings } = await supabase
        .from("payment_settings")
        .select("publishable_key, secret_key")
        .eq("provider", "airwallex")
        .eq("is_active", true)
        .maybeSingle();

      if (settings?.publishable_key && settings?.secret_key) {
        const awConfig = await getAirwallexConfig(supabase);
        const token = await getAirwallexAccessToken(
          settings.publishable_key,
          settings.secret_key,
          awConfig.env,
          awConfig.loginAs,
        );
        const res = await fetch(
          `${getAirwallexApiBase(awConfig.env)}/api/v1/pa/payment_intents/${order.payment_id}`,
          { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
        );
        const intent = await res.json().catch(() => ({}));
        if (res.ok && (intent.status === "SUCCEEDED" || intent.status === "CAPTURE_REQUESTED")) {
          shouldFulfill = true;
        }
      }
    }

    if (shouldFulfill) {
      const { data: fulfilled, error: fulfillErr } = await supabase.rpc(
        "fulfill_certificate_credit_order",
        {
          _order_id: order_id,
          _payment_id: order.payment_id,
          _payment_method: order.payment_method,
        },
      );
      if (fulfillErr) throw fulfillErr;
      if (fulfilled) {
        await sendCreditsMessage(supabase, user.id, order.quantity, provider);
      }
      return new Response(JSON.stringify({
        status: "paid",
        quantity: order.quantity,
        credits_granted: !!fulfilled,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      status: order.status,
      quantity: order.quantity,
      credits_granted: false,
      pending: true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Confirmation failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
