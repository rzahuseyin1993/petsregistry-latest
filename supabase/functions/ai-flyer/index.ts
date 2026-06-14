import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { description, petImageBase64, petName, petBreed, contactInfo, mode } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isTemplate = mode === "template";

    const systemPrompt = isTemplate
      ? `You are a professional graphic designer AI. Generate a complete HTML/CSS flyer template for lost pet posters. 
The template should be A4 portrait (794x1123px). Use inline CSS styles. 
Create a visually appealing, professional design with:
- Bold header area with attention-grabbing title
- Placeholder area for pet photo (use a div with class "pet-photo-placeholder" sized 300x300px)
- Sections for pet details, last seen location, contact info
- A QR code placeholder area
- Eye-catching colors and typography
- Clear call-to-action at the bottom
Return ONLY the HTML code inside a single <div> element. No markdown, no explanation.`
      : `You are a professional graphic designer AI. Generate a complete HTML/CSS lost pet flyer. 
The flyer should be A4 portrait (794x1123px). Use inline CSS styles.
Create a visually appealing, professional design with:
- Bold, attention-grabbing "LOST PET" or "MISSING" header
- Space for the pet photo (include an <img> tag with src="PET_PHOTO_PLACEHOLDER")
- Pet name: ${petName || "Unknown"}
- Breed: ${petBreed || "Unknown"}  
- Description from user
- Contact information: ${contactInfo || "Contact owner"}
- Eye-catching colors and clear typography
- Reward mention if applicable
Return ONLY the HTML code inside a single <div> element. No markdown, no explanation.`;

    const userContent: any[] = [
      { type: "text", text: description || (isTemplate ? "Create a modern, colorful lost pet flyer template" : "Create a lost pet flyer") },
    ];

    if (petImageBase64) {
      userContent.push({
        type: "image_url",
        image_url: { url: petImageBase64 },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests. Please wait and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please try again later." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let html = data.choices?.[0]?.message?.content || "";
    
    // Clean up markdown code fences if present
    html = html.replace(/```html\n?/g, "").replace(/```\n?/g, "").trim();

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-flyer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
