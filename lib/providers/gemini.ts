import type { ChatCall, ChatEvent, ChatMessage, ToolSpec } from "./types";
import { parseToolArgs } from "./types";
import { readSse } from "./sse";

/**
 * Google Gemini adapter (Generative Language API).
 *
 * The API allows direct browser calls with an API-key header (the official
 * @google/generative-ai SDK runs client-side), so — like Anthropic — we call
 * it straight from the browser rather than through our proxy. Streaming uses
 * the `:streamGenerateContent?alt=sse` endpoint, which emits standard SSE
 * `data:` blocks our shared reader already understands.
 *
 * Tools are `functionDeclarations`; a call comes back as a `functionCall`
 * part and its result goes back as a `functionResponse` part. Gemini has no
 * call ids, so we mint one per call and match results by name.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function endpoint(
  model: string,
  method: "streamGenerateContent" | "generateContent",
): string {
  const url = `${BASE}/${encodeURIComponent(model)}:${method}`;
  return method === "streamGenerateContent" ? `${url}?alt=sse` : url;
}

type Part =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

type Content = { role: "user" | "model"; parts: Part[] };

/** Gemini uses "user" / "model"; tool results ride on a user turn as functionResponse parts. */
export function toContents(messages: ChatMessage[]): Content[] {
  const out: Content[] = [];
  for (const m of messages) {
    if (m.role === "tool") {
      const part: Part = {
        functionResponse: { name: m.name, response: { result: m.content } },
      };
      const last = out[out.length - 1];
      if (last && last.role === "user" && "functionResponse" in last.parts[0]) {
        last.parts.push(part);
      } else {
        out.push({ role: "user", parts: [part] });
      }
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const parts: Part[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const c of m.toolCalls) {
        parts.push({ functionCall: { name: c.name, args: parseToolArgs(c.args) } });
      }
      out.push({ role: "model", parts });
      continue;
    }
    out.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }
  return out;
}

function toGeminiTools(tools: ToolSpec[]) {
  return [
    {
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    },
  ];
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
      ...(call.tools?.length ? { tools: toGeminiTools(call.tools) } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Google ${res.status}: ${errText}`);
  }

  yield* parseGeminiStream(dataOf(readSse(res)));
}

async function* dataOf(events: AsyncIterable<{ data: string }>): AsyncIterable<string> {
  for await (const { data } of events) yield data;
}

/** The stream, as events. Function calls arrive whole, as parts. */
export async function* parseGeminiStream(
  datas: AsyncIterable<string>,
): AsyncIterable<ChatEvent> {
  let inputTokens = 0;
  let outputTokens = 0;
  let calls = 0;

  for await (const data of datas) {
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
        if (p.functionCall && typeof p.functionCall.name === "string") {
          calls += 1;
          yield {
            type: "tool_call",
            call: {
              id: `${p.functionCall.name}#${calls}`,
              name: p.functionCall.name,
              args: JSON.stringify(p.functionCall.args ?? {}),
            },
          };
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
    content?: {
      parts?: {
        text?: string;
        functionCall?: { name?: string; args?: Record<string, unknown> };
      }[];
    };
  }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};
