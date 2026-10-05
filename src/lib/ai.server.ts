import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

// Uses the owner's own OpenAI key (billed to their OpenAI account).
const MODEL = "gpt-6-astra";

/** Streams a Responses call server-side and returns the final text. */
export async function generateText(system: string, prompt: string, effort: "low" | "medium" = "medium"): Promise<string> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured (missing OPENAI_API_KEY).");
  let httpError: Error | undefined;
  const provider = createOpenAI({
    apiKey,
    fetch: async (input, init) => {
      const res = await fetch(input, init);
      if (!res.ok) {
        const body = await res.clone().text();
        let msg = body.slice(0, 300);
        try { msg = (JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? msg) as string; } catch { /* keep raw */ }
        if (res.status === 402 || /quota|billing/i.test(msg)) httpError = new Error(`Out of OpenAI credits [402]. ${msg}`);
        else if (res.status === 401) httpError = new Error(`OpenAI key rejected [403]: ${msg}`);
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
