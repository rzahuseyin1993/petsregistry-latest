// AI Moderation worker — scans pending items in moderation_queue with Lovable AI.
// Runs in real-time (called from DB trigger via pg_net) and also on cron schedule.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const SYSTEM_PROMPT = `You are a strict content moderator for Pets Registry, a global pet identity platform.

You MUST flag the following violations:

1. FAKE PET INFORMATION
   - Gibberish names like "asdfgh", "test", "qwerty", "aaaa", random keystrokes
   - Impossible breeds/species (e.g. "T-Rex", "unicorn", made-up words)
   - Nonsensical descriptions or notes (random characters, copy-paste filler)
   - Microchip numbers that are clearly fake (all zeros, all same digit, "123456")

2. FAKE PROFILES / FAKE ADDRESSES
   - Names that are obviously not real (gibberish, single letters, profanity)
   - Addresses with random characters, "123 fake st", "asdf street"
   - Phone numbers that are clearly invalid (1234567890, 0000000000)
   - Cities/countries that don't exist or are gibberish

3. SPAM / SCAMS
   - Promotional messages, advertising unrelated products
   - Crypto/gambling/medication scams, "make money fast"
   - Repeated identical content (likely automated spam)
   - Pyramid schemes, MLM recruitment

4. UNAUTHORIZED EXTERNAL LINKS
   - Links to non-pet-related external sites in pet/profile descriptions
   - Shortened URLs (bit.ly, tinyurl) used in suspicious context
   - Affiliate links, referral schemes
   - WhatsApp/Telegram contacts pushing off-platform

5. ABUSIVE / INAPPROPRIATE CONTENT
   - Threats, hate speech, harassment
   - Adult content, explicit material
   - Animal cruelty references

6. DUPLICATE / COPY-PASTE LISTINGS
   - Generic templates that look mass-produced
   - Identical content across multiple fields

SEVERITY GUIDE:
- HIGH (auto-pause): clearly fake gibberish, obvious spam, scams, abusive content, fake addresses
- MEDIUM: suspicious patterns, low-effort content, possibly fake
- LOW: minor concerns, low confidence

Be reasonably aggressive — false positives are recoverable (admin can dismiss), but missed spam damages the platform.

Reply ONLY with valid JSON:
{"is_problem": boolean, "severity": "low"|"medium"|"high", "confidence": 0.0-1.0, "reason": "short specific reason member can understand", "suggested_action": "review"|"pause"|"delete"}`;

async function classify(entityType: string, payload: any): Promise<any> {
  const userPrompt = `Entity type: ${entityType}\nContent to evaluate:\n${JSON.stringify(payload, null, 2)}`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) throw new Error(`AI gateway ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

async function pauseEntity(supabase: any, entityType: string, entityId: string) {
  const map: Record<string, { table: string; col: string; value: any }> = {
    profile: { table: "profiles", col: "is_paused", value: true },
    pet: { table: "pets", col: "is_paused", value: true },
    business_listing: { table: "business_listings", col: "is_active", value: false },
    lost_report: { table: "lost_reports", col: "is_paused", value: true },
    admin_message: { table: "admin_messages", col: "is_paused", value: true },
    contact_submission: { table: "contact_submissions", col: "is_read", value: true },
  };
  const m = map[entityType];
  if (!m) return;
  await supabase.from(m.table).update({ [m.col]: m.value }).eq("id", entityId);
}

async function notifyAdmins(supabase: any, title: string, message: string) {
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (!admins?.length) return;
  for (const a of admins) {
    await supabase.rpc("insert_system_notification", {
      _user_id: a.user_id,
      _title: title,
      _message: message,
      _type: "moderation",
      _link: "/admin/moderation",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let processed = 0, flagged = 0, paused = 0;

  try {
    // Process up to 50 pending items per invocation
    const { data: jobs } = await supabase
      .from("moderation_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    for (const job of jobs || []) {
      try {
        // Claim job (prevents double-processing if cron + trigger fire concurrently)
        const { data: claimed } = await supabase
          .from("moderation_queue")
          .update({ status: "processing" })
          .eq("id", job.id)
          .eq("status", "pending")
          .select("id")
          .maybeSingle();
        if (!claimed) continue;

        const verdict = await classify(job.entity_type, job.payload);
        processed++;

        if (verdict?.is_problem) {
          flagged++;
          // Lost/found pet reports are intentionally allowed to be incomplete (the public reporter
          // often doesn't know the pet's name, breed, or species). NEVER auto-pause these — flag
          // them for human admin review only. Admins can edit, hide, or delete from the dashboard.
          const isPublicReport = job.entity_type === "lost_report";
          const autoPause = !isPublicReport && (
            (verdict.severity === "high" && (verdict.confidence ?? 0) >= 0.75) ||
            (verdict.severity === "medium" && (verdict.confidence ?? 0) >= 0.9)
          );

          await supabase.from("moderation_flags").insert({
            entity_type: job.entity_type,
            entity_id: job.entity_id,
            owner_user_id: job.owner_user_id,
            severity: verdict.severity || "low",
            confidence: verdict.confidence ?? 0,
            reason: verdict.reason || "Flagged by AI",
            details: { payload: job.payload, verdict, public_report: isPublicReport },
            suggested_action: verdict.suggested_action || "review",
            status: autoPause ? "auto_paused" : "open",
            auto_paused: autoPause,
          });

          if (autoPause) {
            await pauseEntity(supabase, job.entity_type, job.entity_id);
            paused++;
          }

          await notifyAdmins(
            supabase,
            autoPause ? `🚨 Auto-paused ${job.entity_type}` : `⚠️ ${job.entity_type} flagged for review`,
            `${verdict.reason} (severity: ${verdict.severity}, confidence: ${Math.round((verdict.confidence ?? 0) * 100)}%)`
          );
        }

        await supabase.from("moderation_queue").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", job.id);
      } catch (err: any) {
        console.error("Job failed", job.id, err);
        await supabase.from("moderation_queue").update({ status: "error", error: String(err?.message || err) }).eq("id", job.id);
      }
    }

    return new Response(JSON.stringify({ processed, flagged, paused }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ai-moderation error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
