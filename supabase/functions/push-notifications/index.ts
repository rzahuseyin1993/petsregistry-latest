const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Web Push library for Deno
import webpush from "https://esm.sh/web-push@3.6.7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...body } = await req.json();

    // Get VAPID keys from settings
    const { data: settings } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["vapid_public_key", "vapid_private_key", "site_email"]);

    const config: Record<string, string> = {};
    (settings || []).forEach((s: any) => { config[s.key] = s.value; });

    if (action === "generate-vapid") {
      // Generate new VAPID keys
      const vapidKeys = webpush.generateVAPIDKeys();
      
      await supabase.from("site_settings").update({ value: vapidKeys.publicKey }).eq("key", "vapid_public_key");
      await supabase.from("site_settings").update({ value: vapidKeys.privateKey }).eq("key", "vapid_private_key");

      return new Response(
        JSON.stringify({ publicKey: vapidKeys.publicKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get-vapid-public") {
      return new Response(
        JSON.stringify({ publicKey: config.vapid_public_key || "" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send-push") {
      // Send push notification to a specific user or all users
      const { userId, title, message, link, allUsers } = body;

      if (!config.vapid_public_key || !config.vapid_private_key) {
        return new Response(
          JSON.stringify({ error: "VAPID keys not configured. Generate them in Admin Settings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      webpush.setVapidDetails(
        `mailto:${config.site_email || "admin@petsregistry.org"}`,
        config.vapid_public_key,
        config.vapid_private_key
      );

      let query = supabase.from("push_subscriptions").select("*");
      if (!allUsers && userId) {
        query = query.eq("user_id", userId);
      }
      const { data: subscriptions } = await query;

      if (!subscriptions || subscriptions.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, message: "No push subscriptions found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload = JSON.stringify({ title, body: message, url: link || "/" });
      let sent = 0;
      let failed = 0;

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
          sent++;
        } catch (err: any) {
          failed++;
          // Remove expired subscriptions
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          }
        }
      }

      return new Response(
        JSON.stringify({ sent, failed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
