export type ChatMessage = { role: string; content: string | unknown[] };

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  response_format?: { type: string };
  tools?: unknown[];
  tool_choice?: unknown;
}

type AiProvider = "gemini" | "openrouter" | "lovable";

function resolveProvider(): { provider: AiProvider; key: string } {
  const geminiKey = Deno.env.get("GEMINI_API_KEY")?.trim() || Deno.env.get("GOOGLE_API_KEY")?.trim();
  const openRouterKey = Deno.env.get("OPENROUTER_API_KEY")?.trim();
  const lovableKey = Deno.env.get("LOVABLE_API_KEY")?.trim();

  // Prefer client's paid Google Gemini account (used for Pet Expert + admin AI).
  if (geminiKey) {
    return { provider: "gemini", key: geminiKey };
  }

  if (openRouterKey) {
    return { provider: "openrouter", key: openRouterKey };
  }

  if (lovableKey) {
    if (lovableKey.startsWith("sk-or-")) {
      return { provider: "openrouter", key: lovableKey };
    }
    return { provider: "lovable", key: lovableKey };
  }

  throw new AiError(
    "No AI API key configured. Add GEMINI_API_KEY (recommended), OPENROUTER_API_KEY, or LOVABLE_API_KEY in Supabase Edge Function secrets.",
    500,
  );
}

function normalizeModel(provider: AiProvider, model: string): string {
  if (provider === "lovable") return model;

  if (provider === "gemini") {
    const geminiMap: Record<string, string> = {
      "google/gemini-3-pro": "gemini-2.5-pro",
      "google/gemini-2.5-flash": "gemini-2.5-flash",
      "google/gemini-3-flash-preview": "gemini-2.5-flash",
    };
    return geminiMap[model] || model.replace(/^google\//, "gemini-").replace("gemini-gemini", "gemini");
  }

  const openRouterMap: Record<string, string> = {
    "google/gemini-3-pro": "google/gemini-2.5-pro",
    "google/gemini-3-flash-preview": "google/gemini-2.5-flash",
    "gemini-2.5-pro": "google/gemini-2.5-pro",
    "gemini-2.5-flash": "google/gemini-2.5-flash",
  };
  return openRouterMap[model] || model;
}

function apiUrl(provider: AiProvider): string {
  switch (provider) {
    case "gemini":
      return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    case "openrouter":
      return "https://openrouter.ai/api/v1/chat/completions";
    case "lovable":
      return "https://ai.gateway.lovable.dev/v1/chat/completions";
  }
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<Response> {
  const { provider, key } = resolveProvider();
  const model = normalizeModel(provider, options.model);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = Deno.env.get("SITE_URL") || "https://petsregistry.org";
    headers["X-Title"] = "Pets Registry";
  }

  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    stream: options.stream ?? false,
    max_tokens: options.max_tokens ?? 8192,
  };

  if (options.response_format) body.response_format = options.response_format;
  if (options.tools) body.tools = options.tools;
  if (options.tool_choice) body.tool_choice = options.tool_choice;

  return fetch(apiUrl(provider), { method: "POST", headers, body: JSON.stringify(body) });
}

export async function parseAiError(response: Response): Promise<AiError> {
  const text = await response.text();
  console.error(`AI gateway error (${response.status}):`, text);

  if (response.status === 429) {
    return new AiError("Too many requests. Please wait and try again.", 429);
  }
  if (response.status === 402) {
    return new AiError("AI credits exhausted. Please add credits or try again later.", 402);
  }
  if (response.status === 403) {
    return new AiError(
      "Gemini API quota exceeded or billing not enabled. Check your Google AI / Cloud billing.",
      403,
    );
  }
  if (response.status === 401) {
    return new AiError(
      "Invalid AI API key. Check GEMINI_API_KEY, OPENROUTER_API_KEY, or LOVABLE_API_KEY in Supabase secrets.",
      401,
    );
  }

  let message = "AI service error";
  try {
    const parsed = JSON.parse(text);
    message = parsed?.error?.message || parsed?.error?.status || parsed?.error || message;
  } catch {
    if (text) message = text.slice(0, 200);
  }

  return new AiError(message, response.status);
}

export async function chatCompletionJson(
  options: Omit<ChatCompletionOptions, "stream">,
): Promise<Record<string, unknown>> {
  const response = await chatCompletion({ ...options, stream: false });
  if (!response.ok) throw await parseAiError(response);
  return response.json();
}
