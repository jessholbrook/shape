import type { ChatCall, ChatEvent } from "./types";
import { readSse } from "./sse";

/**
 * Shared adapter for OpenAI-compatible chat APIs (OpenAI itself, Cerebras, and
 * — in future — any drop-in `/chat/completions` endpoint). Callers supply the
 * proxy URL, the header the key rides in, and a label for error messages.
 *
 * These providers are proxied through our own edge routes rather than called
 * directly: OpenAI blocks browser calls outright, and we default to the same
 * safe path for others whose CORS behavior we don't control. The key is used
 * for that one request in memory and never logged or stored.
 */
export type OpenAiCompatConfig = {
  proxyUrl: string;
  keyHeader: string;
  label: string;
};

export async function* openAiCompatibleChat(
  call: ChatCall,
  cfg: OpenAiCompatConfig,
): AsyncIterable<ChatEvent> {
  if (!call.apiKey) {
    throw new Error(`${cfg.label} provider requires an API key.`);
  }
  const res = await fetch(cfg.proxyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [cfg.keyHeader]: call.apiKey,
    },
    body: JSON.stringify({
      model: call.model,
      messages: [
        ...(call.system ? [{ role: "system", content: call.system }] : []),
        ...call.messages,
      ],
      temperature: call.temperature,
      max_tokens: call.maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true },
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`${cfg.label} ${res.status}: ${errText}`);
  }

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const { data } of readSse(res)) {
    if (data === "[DONE]") break;
    let parsed: OpenAiSseData;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    const delta = parsed.choices?.[0]?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      yield { type: "text", delta };
    }
    if (parsed.usage) {
      inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
      outputTokens = parsed.usage.completion_tokens ?? outputTokens;
    }
  }

  yield { type: "done", usage: { inputTokens, outputTokens } };
}

export async function pingOpenAiCompatible(
  apiKey: string,
  model: string,
  cfg: OpenAiCompatConfig,
): Promise<void> {
  const res = await fetch(cfg.proxyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [cfg.keyHeader]: apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`${cfg.label} ${res.status}: ${errText}`);
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

type OpenAiSseData = {
  choices?: { delta?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
