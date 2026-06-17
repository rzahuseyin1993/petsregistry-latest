import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AiError, chatCompletion, parseAiError } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are PetPal AI Expert — a friendly, knowledgeable veterinary advisor and pet care specialist. You help pet owners with:
- Health concerns and symptoms (always recommend seeing a vet for serious issues)
- Nutrition and diet advice for dogs, cats, birds, fish, reptiles, and other pets
- Behavioral training tips and solutions
- Grooming and hygiene guidance
- Exercise and activity recommendations
- General pet care best practices
- Visual diagnosis: When a user sends a photo of their pet, analyze visible symptoms (skin issues, eye problems, injuries, posture, etc.) and provide possible explanations

Important rules:
- Always be warm, empathetic and encouraging
- For serious medical symptoms, always advise consulting a veterinarian
- When analyzing pet photos, describe what you observe and suggest possible conditions
- Provide practical, actionable advice
- Use simple language, avoid jargon
- If unsure, say so honestly
- Keep responses concise but helpful (under 300 words unless the topic needs more detail)
- Use emojis sparingly to keep things friendly 🐾`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    const transformedMessages = messages.map((msg: { role: string; content: string; imageUrl?: string }) => {
      if (msg.role === "user" && msg.imageUrl) {
        return {
          role: "user",
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.imageUrl } },
          ],
        };
      }
      return msg;
    });

    const response = await chatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...transformedMessages,
      ],
      model: "gemini-2.5-flash",
      stream: true,
      max_tokens: 2048,
    });

    if (!response.ok) {
      const err = await parseAiError(response);
      return new Response(JSON.stringify({ error: err.message }), {
        status: err.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("pet-expert error:", e);
    const status = e instanceof AiError ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
