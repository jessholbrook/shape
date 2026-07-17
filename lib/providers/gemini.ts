import type { ChatCall, ChatEvent, ChatMessage } from "./types";
import { readSse } from "./sse";

/**
 * Google Gemini adapter (Generative Language API).
 *
 * The API allows direct browser calls with an API-key header (the official
 * @google/generative-ai SDK runs client-side), so — like Anthropic — we call
 * it straight from the browser rather than through our proxy. Streaming uses
 * the `:streamGenerateContent?alt=sse` endpoint, which emits standard SSE
 * `data:` blocks our shared reader already understands.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function endpoint(
  model: string,
  method: "streamGenerateContent" | "generateContent",
): string {
  const url = `${BASE}/${encodeURIComponent(model)}:${method}`;
  return method === "streamGenerateContent" ? `${url}?alt=sse` : url;
}

/** Gemini uses "user" / "model"; map our "assistant" role to "model". */
function toContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export async function* geminiChat(call: ChatCall): AsyncIterable<ChatEvent> {
  if (!call.apiKey) {
    throw new Error("Google Gemini provider requires an API key.");
  }
  const res = await fetch(endpoint(call.model, "streamGenerateContent"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": call.apiKey,
    },
    body: JSON.stringify({
      ...(call.system
        ? { systemInstruction: { parts: [{ text: call.system }] } }
        : {}),
      contents: toContents(call.messages),
      generationConfig: {
        temperature: call.temperature,
        maxOutputTokens: call.maxTokens ?? 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Google ${res.status}: ${errText}`);
  }

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const { data } of readSse(res)) {
    let parsed: GeminiSseData;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    const parts = parsed.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const p of parts) {
        if (typeof p.text === "string" && p.text.length > 0) {
          yield { type: "text", delta: p.text };
        }
      }
    }
    if (parsed.usageMetadata) {
      inputTokens = parsed.usageMetadata.promptTokenCount ?? inputTokens;
      outputTokens = parsed.usageMetadata.candidatesTokenCount ?? outputTokens;
    }
  }

  yield { type: "done", usage: { inputTokens, outputTokens } };
}

export async function pingGemini(apiKey: string, model: string): Promise<void> {
  const res = await fetch(endpoint(model, "generateContent"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "hi" }] }],
      generationConfig: { maxOutputTokens: 1 },
    }),
  });
  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Google ${res.status}: ${errText}`);
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const body = await res.text();
    try {
      const json = JSON.parse(body);
      return json?.error?.message ?? json?.message ?? body.slice(0, 200);
    } catch {
      return body.slice(0, 200);
    }
  } catch {
    return res.statusText;
  }
}

type GeminiSseData = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};
