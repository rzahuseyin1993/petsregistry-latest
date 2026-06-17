export type GeminiMessage = { role: string; content: string | unknown[] };

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function getGeminiApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY")?.trim() || Deno.env.get("GOOGLE_API_KEY")?.trim();
  if (!key) {
    throw new GeminiError(
      "GEMINI_API_KEY is not configured. Add it in Supabase Dashboard → Edge Functions → Secrets.",
      500,
    );
  }
  return key;
}

export function getGeminiModel(): string {
  return Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash";
}

/** Google Gemini via the OpenAI-compatible endpoint (uses your Google AI / Gemini paid account). */
export async function geminiChatCompletion(options: {
  model?: string;
  messages: GeminiMessage[];
  stream?: boolean;
  max_tokens?: number;
}): Promise<Response> {
  const key = getGeminiApiKey();
  const model = options.model || getGeminiModel();

  return fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      stream: options.stream ?? false,
      max_tokens: options.max_tokens ?? 2048,
    }),
  });
}

export async function parseGeminiError(response: Response): Promise<GeminiError> {
  const text = await response.text();
  console.error(`Gemini API error (${response.status}):`, text);

  if (response.status === 429) {
    return new GeminiError("Too many requests. Please wait and try again.", 429);
  }
  if (response.status === 402 || response.status === 403) {
    return new GeminiError(
      "Gemini API quota exceeded or billing not enabled. Check your Google AI / Cloud billing.",
      response.status,
    );
  }
  if (response.status === 401 || response.status === 400) {
    return new GeminiError(
      "Invalid Gemini API key. Check GEMINI_API_KEY in Supabase Edge Function secrets.",
      response.status,
    );
  }

  let message = "AI service error";
  try {
    const parsed = JSON.parse(text);
    message = parsed?.error?.message || parsed?.error?.status || message;
  } catch {
    if (text) message = text.slice(0, 200);
  }

  return new GeminiError(message, response.status);
}
