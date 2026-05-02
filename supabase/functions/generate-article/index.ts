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

    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    if (userError || !authUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authUser.id;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { topic, categories, cover_image_url, title } = await req.json();
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const titleHint = title?.trim() ? `Use this exact title: "${title.trim()}"` : "";
    const catHint = categories?.length ? `Include these tags: ${categories.join(", ")}` : "";

    const articleResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional pet care blog writer. Write engaging, SEO-optimized articles about pets.
Always respond with valid JSON in this exact format:
{
  "title": "Article Title Here",
  "slug": "article-slug-here",
  "excerpt": "A brief 1-2 sentence summary",
  "content": "<h2>Section</h2><p>Content with HTML formatting...</p>",
  "tags": ["Tag1", "Tag2"],
  "meta_title": "SEO Title (max 60 chars)",
  "meta_description": "SEO description (max 160 chars)"
}
Write at least 800 words. Use proper HTML: h2, h3, p, ul/li, strong, em tags.
Make the content informative, practical, and engaging for pet owners.`
          },
          {
            role: "user",
            content: `Write a comprehensive article about: "${topic.trim()}"
${titleHint}
${catHint}`.trim()
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_article",
              description: "Create a blog article with structured data",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Article title" },
                  slug: { type: "string", description: "URL-friendly slug" },
                  excerpt: { type: "string", description: "Brief summary (1-2 sentences)" },
                  content: { type: "string", description: "Full article content in HTML" },
                  tags: { type: "array", items: { type: "string" }, description: "Article tags/categories" },
                  meta_title: { type: "string", description: "SEO meta title (max 60 chars)" },
                  meta_description: { type: "string", description: "SEO meta description (max 160 chars)" },
                },
                required: ["title", "slug", "excerpt", "content", "tags", "meta_title", "meta_description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_article" } },
      }),
    });

    if (!articleResponse.ok) {
      if (articleResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (articleResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await articleResponse.text();
      console.error("AI error:", articleResponse.status, errText);
      throw new Error("Failed to generate article");
    }

    const articleData = await articleResponse.json();
    const toolCall = articleData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured article data");
    }

    const article = JSON.parse(toolCall.function.arguments);

    const slug = article.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    const { data: insertedPost, error: insertError } = await adminClient
      .from("blog_posts")
      .insert({
        title: title?.trim() || article.title,
        slug,
        content: article.content,
        excerpt: article.excerpt,
        cover_image_url: cover_image_url || null,
        tags: article.tags || [],
        is_published: true,
        published_at: new Date().toISOString(),
        author_id: userId,
        meta_title: article.meta_title || null,
        meta_description: article.meta_description || null,
        moderation_status: "approved",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ success: true, post: insertedPost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-article error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
