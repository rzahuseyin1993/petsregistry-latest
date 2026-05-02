// Daily cleanup for lost_reports based on admin-configured retention.
// - Deletes ALL lost_reports older than `lost_report_retention_days`.
// - Auto-clears (sets status='resolved') reports marked 'found' that have been
//   visible for more than `lost_report_found_visible_days` days, then deletes them too.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["lost_report_retention_days", "lost_report_found_visible_days"]);

    const map = Object.fromEntries((settings || []).map((s: any) => [s.key, s.value]));
    const retentionDays = parseInt(map["lost_report_retention_days"] ?? "365", 10);
    const foundVisibleDays = parseInt(map["lost_report_found_visible_days"] ?? "7", 10);

    let deletedOld = 0;
    let deletedFound = 0;

    // 1) Delete reports older than retention window (any status).
    if (retentionDays > 0) {
      const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
      const { data, error } = await supabase
        .from("lost_reports")
        .delete()
        .lt("created_at", cutoff)
        .select("id");
      if (error) throw error;
      deletedOld = data?.length || 0;
    }

    // 2) Delete found reports whose updated_at is older than the found-visible window.
    if (foundVisibleDays >= 0) {
      const cutoff = new Date(Date.now() - foundVisibleDays * 86400000).toISOString();
      const { data, error } = await supabase
        .from("lost_reports")
        .delete()
        .eq("status", "found")
        .lt("updated_at", cutoff)
        .select("id");
      if (error) throw error;
      deletedFound = data?.length || 0;
    }

    return new Response(
      JSON.stringify({ ok: true, deletedOld, deletedFound, retentionDays, foundVisibleDays }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("cleanup-lost-reports error:", e);
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
