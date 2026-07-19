// Trusted server-side messaging to pet/adoption owners.
// Centralises "contact owner" style flows so the public client never talks to
// send-smtp-email or insert_system_notification directly (prevents open mail
// relay + notification spam). All owner lookups use the service role.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const safe = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const clamp = (s: unknown, max: number) => String(s ?? "").trim().slice(0, max);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json();
    const action = String(payload.action || "");

    // Resolve the calling user (optional for public actions, required for others)
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let callerId: string | null = null;
    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const { data } = await supabase.auth.getUser(token);
      callerId = data?.user?.id ?? null;
    }

    const notifyUser = (userId: string, title: string, message: string, type: string, link: string) =>
      supabase.rpc("insert_system_notification", {
        _user_id: userId,
        _title: title,
        _message: message,
        _type: type,
        _link: link,
      });

    const sendEmail = (to: string, subject: string, html: string) =>
      supabase.functions.invoke("send-smtp-email", { body: { to, subject, html } });

    const getProfile = async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    };

    // ── Public: contact a pet's owner (QR scan / pet profile) ──
    if (action === "pet_contact") {
      const petId = String(payload.petId || "");
      const senderName = clamp(payload.senderName, 100);
      const senderContact = clamp(payload.senderContact, 200);
      const message = clamp(payload.message, 1000);
      if (!petId || !senderName || !message) return json({ error: "Missing required fields" }, 400);

      const { data: pet } = await supabase
        .from("pets")
        .select("id, name, owner_id")
        .eq("id", petId)
        .maybeSingle();
      if (!pet?.owner_id) return json({ error: "Pet not found" }, 404);

      const contactLine = [senderName, senderContact].filter(Boolean).join(" · ");
      await notifyUser(
        pet.owner_id,
        `📩 Someone contacted you about ${pet.name}`,
        `From ${contactLine}\n\n${message}`,
        "scan",
        `/pet/${pet.id}`,
      );

      const owner = await getProfile(pet.owner_id);
      if (owner?.email) {
        await sendEmail(
          owner.email,
          `🐾 Someone contacted you about ${pet.name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#dc2626">Someone wants to contact you about ${safe(pet.name)}</h2>
            <p><strong>From:</strong> ${safe(senderName)}</p>
            <p><strong>Contact:</strong> ${safe(senderContact)}</p>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${safe(message)}</div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">— Pets Registry</p>
          </div>`,
        ).catch(() => {});
      }
      return json({ success: true });
    }

    // ── Public: adoption inquiry (arrange a meet-up) ──
    if (action === "adoption_inquiry") {
      const adoptionId = String(payload.adoptionId || "");
      const senderName = clamp(payload.senderName, 100);
      const senderEmail = clamp(payload.senderEmail, 200);
      const senderPhone = clamp(payload.senderPhone, 50);
      const message = clamp(payload.message, 1000);
      if (!adoptionId || !senderName || !senderEmail || !message) {
        return json({ error: "Missing required fields" }, 400);
      }

      const { data: listing } = await supabase
        .from("pet_adoptions")
        .select("id, owner_id, pets(name)")
        .eq("id", adoptionId)
        .maybeSingle();
      if (!listing?.owner_id) return json({ error: "Listing not found" }, 404);
      const petName = (listing as any).pets?.name || "your pet";

      const contactLine = [senderName, senderEmail, senderPhone ? `phone: ${senderPhone}` : null]
        .filter(Boolean)
        .join(" · ");
      await notifyUser(
        listing.owner_id,
        `Adoption inquiry for ${petName}`,
        `From ${contactLine}\n\n${message}`,
        "adoption",
        "/dashboard/adoption",
      );

      const owner = await getProfile(listing.owner_id);
      if (owner?.email) {
        await sendEmail(
          owner.email,
          `Someone is interested in adopting ${petName}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#e11d48">🐾 Adoption inquiry for ${safe(petName)}</h2>
            <p>Hi ${safe(owner.full_name || "Pet Owner")},</p>
            <p>Someone would like to adopt <strong>${safe(petName)}</strong> and arrange a meet-up in person.</p>
            <p><strong>From:</strong> ${safe(senderName)}</p>
            <p><strong>Email:</strong> <a href="mailto:${safe(senderEmail)}">${safe(senderEmail)}</a></p>
            ${senderPhone ? `<p><strong>Phone:</strong> ${safe(senderPhone)}</p>` : ""}
            <div style="background:#fff1f2;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${safe(message)}</div>
            <p style="color:#6b7280;font-size:13px;margin-top:24px">— Pets Registry</p>
          </div>`,
        ).catch(() => {});
      }
      return json({ success: true });
    }

    // ── Authenticated: adoption request (adopter → owner) ──
    if (action === "adoption_request") {
      if (!callerId) return json({ error: "You must be signed in" }, 401);
      const adoptionId = String(payload.adoptionId || "");
      const { data: listing } = await supabase
        .from("pet_adoptions")
        .select("id, owner_id, adopter_id, pets(name)")
        .eq("id", adoptionId)
        .maybeSingle();
      if (!listing) return json({ error: "Listing not found" }, 404);
      if (listing.adopter_id !== callerId) return json({ error: "Forbidden" }, 403);
      const petName = (listing as any).pets?.name || "your pet";

      await notifyUser(
        listing.owner_id,
        "New Adoption Request",
        `Someone has requested to adopt ${petName}. Go to your Adoption Manager to review and confirm.`,
        "adoption",
        "/dashboard/adoption",
      );

      const owner = await getProfile(listing.owner_id);
      if (owner?.email) {
        await sendEmail(
          owner.email,
          `New Adoption Request for ${petName}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
            <h2 style="color:#e11d48">🐾 New Adoption Request</h2>
            <p>Hi ${safe(owner.full_name || "Pet Owner")},</p>
            <p>Someone has requested to adopt <strong>${safe(petName)}</strong>.</p>
            <p>Please log in to your <strong>Adoption Manager</strong> dashboard to review and respond.</p>
            <p style="margin-top:24px;color:#6b7280;font-size:13px">— Pets Registry</p>
          </div>`,
        ).catch(() => {});
      }
      return json({ success: true });
    }

    // ── Authenticated: transfer complete → email both parties ──
    if (action === "adoption_transfer_complete") {
      if (!callerId) return json({ error: "You must be signed in" }, 401);
      const adoptionId = String(payload.adoptionId || "");
      const { data: listing } = await supabase
        .from("pet_adoptions")
        .select("id, owner_id, adopter_id, pets(name)")
        .eq("id", adoptionId)
        .maybeSingle();
      if (!listing) return json({ error: "Listing not found" }, 404);
      if (callerId !== listing.owner_id && callerId !== listing.adopter_id) {
        return json({ error: "Forbidden" }, 403);
      }
      const petName = (listing as any).pets?.name || "the pet";

      const owner = listing.owner_id ? await getProfile(listing.owner_id) : null;
      const adopter = listing.adopter_id ? await getProfile(listing.adopter_id) : null;
      if (owner?.email) {
        await sendEmail(
          owner.email,
          "Pet Transfer Complete",
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><p>Dear ${safe(owner.full_name || "Member")},</p><p>Your pet <strong>${safe(petName)}</strong> has been successfully transferred to the new owner.</p><p>Thank you for using Pets Registry.</p></div>`,
        ).catch(() => {});
      }
      if (adopter?.email) {
        await sendEmail(
          adopter.email,
          "Adoption Complete - Pet Transferred!",
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px"><p>Dear ${safe(adopter.full_name || "Member")},</p><p>Congratulations! The pet <strong>${safe(petName)}</strong> has been transferred to your account.</p><p>You can now manage your new pet from your dashboard.</p><p>Thank you for using Pets Registry.</p></div>`,
        ).catch(() => {});
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("owner-messaging error:", err);
    return json({ error: message }, 500);
  }
});
