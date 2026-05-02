import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Find memberships expiring within 7 days (not yet notified)
    const { data: expiringSoon, error: err1 } = await supabase
      .from("memberships")
      .select("id, user_id, expires_at, membership_plans(name)")
      .eq("status", "active")
      .lte("expires_at", sevenDaysFromNow.toISOString())
      .gt("expires_at", now.toISOString());

    if (err1) throw err1;

    let notifiedCount = 0;

    for (const m of expiringSoon || []) {
      // Check if we already sent an expiry-warning notification for this membership
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", m.user_id)
        .eq("type", "membership_expiry_warning")
        .contains("metadata", { membership_id: m.id })
        .limit(1);

      if (existing && existing.length > 0) continue;

      const daysLeft = Math.ceil(
        (new Date(m.expires_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const planName = (m.membership_plans as any)?.name || "Membership";

      await supabase.rpc("insert_system_notification", {
        _user_id: m.user_id,
        _title: "Membership Expiring Soon",
        _message: `Your ${planName} membership expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Renew now to keep your benefits!`,
        _type: "membership_expiry_warning",
        _link: "/dashboard/membership",
        _metadata: JSON.stringify({ membership_id: m.id }),
      });
      notifiedCount++;
    }

    // 2. Find memberships that have expired (mark as expired + notify)
    const { data: expired, error: err2 } = await supabase
      .from("memberships")
      .select("id, user_id, expires_at, membership_plans(name)")
      .eq("status", "active")
      .lt("expires_at", now.toISOString());

    if (err2) throw err2;

    let expiredCount = 0;

    for (const m of expired || []) {
      // Update status to expired
      await supabase
        .from("memberships")
        .update({ status: "expired" })
        .eq("id", m.id);

      // Check if we already sent an expired notification
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", m.user_id)
        .eq("type", "membership_expired")
        .contains("metadata", { membership_id: m.id })
        .limit(1);

      if (existing && existing.length > 0) continue;

      const planName = (m.membership_plans as any)?.name || "Membership";

      await supabase.rpc("insert_system_notification", {
        _user_id: m.user_id,
        _title: "Membership Expired",
        _message: `Your ${planName} membership has expired. Renew to regain your benefits and badge.`,
        _type: "membership_expired",
        _link: "/membership",
        _metadata: JSON.stringify({ membership_id: m.id }),
      });
      expiredCount++;
    }

    return new Response(
      JSON.stringify({ notifiedExpiringSoon: notifiedCount, markedExpired: expiredCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
