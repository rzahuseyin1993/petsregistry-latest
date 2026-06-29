// Routes "I Found This Pet" tips to the real owner/reporter (not the placeholder pet admin).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const safe = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      petId,
      lostReportId,
      tipperName,
      tipperEmail,
      tipperPhone,
      whereFound,
      details,
      photoUrl,
      origin,
    } = await req.json();

    if (!petId || !tipperName?.trim() || !tipperEmail?.trim()) {
      return new Response(JSON.stringify({ error: "petId, tipperName, and tipperEmail are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let report: Record<string, unknown> | null = null;
    if (lostReportId) {
      const { data } = await supabase.from("lost_reports").select("*").eq("id", lostReportId).maybeSingle();
      report = data;
    } else {
      const { data } = await supabase
        .from("lost_reports")
        .select("*")
        .eq("pet_id", petId)
        .in("status", ["active", "found"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      report = data;
    }

    const { data: pet } = await supabase
      .from("pets")
      .select("id, name, owner_id")
      .eq("id", petId)
      .maybeSingle();

    const { data: guestPetSetting } = await supabase
      .from("site_settings")
      .select("value")
      .eq("key", "guest_lost_pet_id")
      .maybeSingle();
    const isPlaceholderPet = guestPetSetting?.value === petId;

    const displayName =
      (typeof report?.guest_pet_name === "string" && report.guest_pet_name.trim()) ||
      pet?.name ||
      "this pet";

    const siteOrigin = typeof origin === "string" && origin ? origin : "https://petsregistry.org";
    const listingPath = report?.is_guest && report?.id
      ? `/lost-pets?report=${report.id}`
      : `/pet/${petId}`;
    const listingUrl = `${siteOrigin}${listingPath}`;

    let notifyUserId: string | null = null;
    let emailTo: string | null = null;

    if (report) {
      if (typeof report.reporter_id === "string" && report.reporter_id) {
        notifyUserId = report.reporter_id;
      } else if (report.is_guest && typeof report.guest_email === "string" && report.guest_email) {
        emailTo = report.guest_email;
      } else if (!report.is_guest && pet?.owner_id) {
        notifyUserId = pet.owner_id;
      }
    } else if (pet?.owner_id && !isPlaceholderPet) {
      notifyUserId = pet.owner_id;
    }

    if (notifyUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", notifyUserId)
        .maybeSingle();
      if (profile?.email) emailTo = profile.email;
    }

    if (!notifyUserId && !emailTo) {
      return new Response(JSON.stringify({ error: "Could not find this pet's owner" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contactLine = [tipperName.trim(), tipperEmail.trim(), tipperPhone?.trim() ? `phone: ${tipperPhone.trim()}` : null]
      .filter(Boolean)
      .join(" · ");

    const bodyLines = [
      details?.trim() || "Someone reported finding your pet.",
      "",
      `Where: ${whereFound?.trim() || "(not provided)"}`,
      photoUrl ? `Photo: ${photoUrl}` : null,
      `Listing: ${listingUrl}`,
    ].filter(Boolean);
    const fullMessage = bodyLines.join("\n");

    if (notifyUserId) {
      await supabase.rpc("insert_system_notification", {
        _user_id: notifyUserId,
        _title: `🐾 Someone found ${displayName}!`,
        _message: `From ${contactLine}\n\n${fullMessage.slice(0, 500)}`,
        _type: "lost_pet",
        _link: "/dashboard/inbox",
      });
    }

    if (emailTo) {
      const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#16a34a">Good news — someone may have found ${safe(displayName)}</h2>
        <p><strong>From:</strong> ${safe(tipperName.trim())}</p>
        <p><strong>Email:</strong> <a href="mailto:${safe(tipperEmail.trim())}">${safe(tipperEmail.trim())}</a></p>
        ${tipperPhone?.trim() ? `<p><strong>Phone:</strong> ${safe(tipperPhone.trim())}</p>` : ""}
        ${whereFound?.trim() ? `<p><strong>Where found:</strong> ${safe(whereFound.trim())}</p>` : ""}
        <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${safe(details?.trim() || "No extra details provided.")}</div>
        ${photoUrl ? `<p><img src="${safe(photoUrl)}" alt="Photo from finder" style="max-width:100%;border-radius:8px;margin:12px 0" /></p>` : ""}
        <p><a href="${safe(listingUrl)}">View lost pet listing</a></p>
        <p style="color:#6b7280;font-size:13px;margin-top:24px">— Pets Registry</p>
      </div>`;

      await supabase.functions.invoke("send-smtp-email", {
        body: {
          to: emailTo,
          subject: `🐾 Someone found ${displayName}!`,
          html,
        },
      }).catch((e) => console.error("Email failed:", e));
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("found-pet-tip error:", err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
