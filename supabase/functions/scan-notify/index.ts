// Notifies a pet owner when their QR is scanned: in-app notification + SMTP email with Google Maps link.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { petId, lat, lng } = await req.json();
    if (!petId) {
      return new Response(JSON.stringify({ error: "petId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch pet + owner
    const { data: pet, error: petErr } = await supabase
      .from("pets")
      .select("id, name, owner_id")
      .eq("id", petId)
      .maybeSingle();
    if (petErr || !pet) {
      return new Response(JSON.stringify({ error: "Pet not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: owner } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("user_id", pet.owner_id)
      .maybeSingle();

    const hasCoords = typeof lat === "number" && typeof lng === "number";
    const mapsUrl = hasCoords
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : null;
    const locationLine = hasCoords
      ? `📍 Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : "📍 Location: Scanner did not share location.";

    // In-app notification
    await supabase.rpc("insert_system_notification", {
      _user_id: pet.owner_id,
      _title: `🔔 ${pet.name}'s tag was scanned`,
      _message: hasCoords
        ? `Someone scanned ${pet.name}'s QR tag. Tap to see the location on the map.`
        : `Someone scanned ${pet.name}'s QR tag. They did not share their location.`,
      _type: "scan",
      _link: mapsUrl || `/pet/${pet.id}`,
      _metadata: { pet_id: pet.id, lat: hasCoords ? lat : null, lng: hasCoords ? lng : null },
    });

    // Email via existing SMTP function (best-effort)
    if (owner?.email) {
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#fff">
          <h2 style="color:#dc2626;margin:0 0 12px">🐾 ${pet.name}'s tag was just scanned</h2>
          <p>Hi ${owner.full_name || "there"},</p>
          <p>Good news — someone just scanned the QR tag belonging to <strong>${pet.name}</strong>.</p>
          <p style="margin:16px 0;padding:12px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px">${locationLine}</p>
          ${mapsUrl ? `<p><a href="${mapsUrl}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">View on Google Maps</a></p>` : ""}
          <p style="color:#6b7280;font-size:13px;margin-top:24px">— Pets Registry</p>
        </div>`;

      await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: owner.email,
          subject: `🐾 ${pet.name}'s tag was scanned`,
          html,
          text: `${pet.name}'s tag was scanned. ${locationLine}${mapsUrl ? ` ${mapsUrl}` : ""}`,
        },
      }).catch((e) => console.error("Email failed:", e));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("scan-notify error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
