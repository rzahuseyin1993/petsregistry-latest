const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authorization: only trusted callers may send mail. Either the service role
    // (internal calls from other edge functions) or an authenticated admin user.
    // This prevents the endpoint from being abused as an open mail relay.
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let authorized = token === supabaseServiceKey;
    if (!authorized && token) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (uid) {
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
        authorized = !!isAdmin;
      }
    }
    if (!authorized) {
      return new Response(
        JSON.stringify({ error: "Not authorized to send email" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get SMTP settings from site_settings
    const { data: settings, error: settingsError } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [
        "smtp_host", "smtp_port", "smtp_username", "smtp_password",
        "smtp_from_email", "smtp_from_name", "smtp_enabled"
      ]);

    if (settingsError) throw new Error("Failed to load SMTP settings: " + settingsError.message);

    const config: Record<string, string> = {};
    (settings || []).forEach((s: any) => { config[s.key] = s.value; });

    if (config.smtp_enabled !== "true") {
      return new Response(
        JSON.stringify({ error: "SMTP is not enabled. Enable it in Admin Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.smtp_host || !config.smtp_from_email) {
      return new Response(
        JSON.stringify({ error: "SMTP host and from email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, html, text } = await req.json();

    if (!to || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const port = parseInt(config.smtp_port || "587", 10);
    const useTLS = port === 465;

    const client = new SMTPClient({
      connection: {
        hostname: config.smtp_host,
        port,
        tls: useTLS,
        auth: config.smtp_username ? {
          username: config.smtp_username,
          password: config.smtp_password || "",
        } : undefined,
      },
    });

    await client.send({
      from: config.smtp_from_name
        ? `${config.smtp_from_name} <${config.smtp_from_email}>`
        : config.smtp_from_email,
      to,
      subject,
      content: text || "Please view this email in an HTML-capable client.",
      html: html || undefined,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("SMTP Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
