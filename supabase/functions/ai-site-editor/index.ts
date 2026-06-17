import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { AiError, chatCompletionJson } from "../_shared/aiClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin/seo_admin role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isSeoAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "seo_admin" });
    if (!isAdmin && !isSeoAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { html, css, instruction } = await req.json();
    if (!instruction || typeof instruction !== "string") {
      return new Response(JSON.stringify({ error: "Instruction is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY");
    if (!GEMINI_API_KEY && !LOVABLE_API_KEY && !OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isGenerateMode = instruction.toLowerCase().includes("generate a complete") || instruction.toLowerCase().includes("from scratch");

    const systemPrompt = isGenerateMode
      ? `You are an expert web designer. The user wants you to generate a complete, professional webpage from scratch. Follow these rules:
- Create a full, modern, responsive page with multiple sections (hero, features, CTA, etc.).
- Use clean, semantic HTML with inline styles for a polished look.
- Use professional color schemes, good typography (Inter, Outfit fonts via Google Fonts), and proper spacing.
- Make it mobile-friendly with max-width containers and flexible layouts.
- Do NOT add <script> tags or JavaScript.
- Do NOT add external resources or CDN links.
- Return the complete HTML and CSS using the update_page tool.`
      : `You are an expert web designer and HTML/CSS editor. The user will give you the current HTML and CSS of a webpage section, along with an instruction for what to change.

Your job is to return the MODIFIED HTML and CSS based on the instruction. Follow these rules:
- Only modify what the user asks for. Keep everything else the same.
- Use inline styles or the CSS block as appropriate.
- Keep the HTML clean and well-structured.
- Use modern, professional web design patterns.
- Maintain responsive design considerations.
- Do NOT add <script> tags or JavaScript.
- Do NOT add external resources or CDN links.
- Return ONLY the modified HTML and CSS, nothing else.

You MUST respond using the update_page tool with the modified HTML and CSS.`;

    const userMessage = `## Current HTML:
\`\`\`html
${html || "<div>Empty page</div>"}
\`\`\`

## Current CSS:
\`\`\`css
${css || "/* No styles yet */"}
\`\`\`

## Instruction:
${instruction}`;

    const aiResult = await chatCompletionJson({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 8192,
      tools: [
        {
          type: "function",
          function: {
            name: "update_page",
            description: "Update the webpage with new HTML and CSS",
            parameters: {
              type: "object",
              properties: {
                html: { type: "string", description: "The complete modified HTML content" },
                css: { type: "string", description: "The complete modified CSS content" },
                summary: { type: "string", description: "A brief 1-sentence summary of what was changed" },
              },
              required: ["html", "css", "summary"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "update_page" } },
    });

    const toolCall = (aiResult.choices as any[])?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return valid output" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      html: parsed.html,
      css: parsed.css,
      summary: parsed.summary || "Changes applied",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-site-editor error:", e);
    const status = e instanceof AiError ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
