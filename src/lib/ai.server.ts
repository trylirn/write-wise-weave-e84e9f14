import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";

/** Streams a Responses call server-side and returns the final text. */
async function generateWithLovable(system: string, prompt: string, effort: "low" | "medium" = "medium"): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing LOVABLE_API_KEY).");
  let runId: string | undefined;
  let httpError: Error | undefined;
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      if (!res.ok) {
        const body = await res.clone().text();
        let msg = body.slice(0, 300);
        try { msg = (JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? msg) as string; } catch { /* keep raw */ }
        if (res.status === 402) httpError = new Error(`Out of AI credits [402]. ${msg}`);
        else if (res.status === 403) httpError = new Error(`AI access blocked [403]: ${msg}`);
        else if (res.status === 429) httpError = new Error("AI is busy right now (rate limited). Will try again on the next run.");
        else httpError = new Error(`AI request failed [${res.status}]: ${msg}`);
        throw httpError;
      }
      return res;
    },
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    system,
    prompt,
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: effort,
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text = "";
  try {
    text = await result.text;
  } catch (e) {
    throw httpError ?? (streamError instanceof Error ? streamError : e);
  }
  if (!text) throw httpError ?? (streamError instanceof Error ? streamError : new Error("The AI returned an empty response (it may have declined the request)."));
  return text;
}

/* ---------- DeepSeek = the main AI. The Lovable AI above is the backup. ---------- */
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-flash";

async function generateWithDeepSeek(system: string, prompt: string): Promise<string> {
  const apiKey = process.env["DEEPSEEK_API_KEY"]?.trim();
  if (!apiKey) throw new Error("DeepSeek is not configured (missing DEEPSEEK_API_KEY).");
  const body = JSON.stringify({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: `${system}\n\nRespond with one valid JSON object only. No markdown fences.` },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    thinking: { type: "disabled" }, // faster and cheaper. Change "disabled" to "enabled" for deeper thinking.
    temperature: 0.7,
    max_tokens: 16000,
    stream: false,
  });
  let lastError = new Error("DeepSeek request failed.");
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res: Response;
    try {
      res = await fetch(DEEPSEEK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
        signal: AbortSignal.timeout(180_000),
      });
    } catch (e) {
      throw new Error(`DeepSeek could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string | null }; finish_reason?: string }[];
      };
      const choice = json.choices?.[0];
      const text = choice?.message?.content?.trim() ?? "";
      if (!text) throw new Error("DeepSeek returned an empty answer.");
      if (choice?.finish_reason === "length") throw new Error("DeepSeek's answer was cut off (too long).");
      return text;
    }
    const raw = await res.text();
    let msg = raw.slice(0, 300);
    try { msg = (JSON.parse(raw)?.error?.message ?? msg) as string; } catch { /* keep raw */ }
    lastError = new Error(`DeepSeek request failed [${res.status}]: ${msg}`);
    const worthRetrying = res.status === 429 || res.status === 500 || res.status === 503;
    if (!worthRetrying || attempt === 2) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw lastError;
}

/** Used by the whole app: tries DeepSeek first and only uses the Lovable AI if DeepSeek fails. */
export async function generateText(system: string, prompt: string, effort: "low" | "medium" = "medium"): Promise<string> {
  if (!process.env["DEEPSEEK_API_KEY"]) return generateWithLovable(system, prompt, effort);
  try {
    const text = await generateWithDeepSeek(system, prompt);
    try { parseJson(text); } catch { throw new Error("DeepSeek's answer was not valid JSON."); }
    return text;
  } catch (e) {
    console.error("[AI] DeepSeek failed, using the backup AI instead:", e instanceof Error ? e.message : e);
  }
  try {
    return await generateWithLovable(system, prompt, effort);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`${msg} (DeepSeek was tried first and also failed. Check your DeepSeek key and balance.)`);
  }
}

export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error("Could not read the AI response as structured data. Please try again.");
  }
}
