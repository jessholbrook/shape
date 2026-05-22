import type { ChatCall, ChatEvent } from "./types";
import { readSse } from "./sse";

/**
 * OpenAI's API is blocked from direct browser calls by Cloudflare bot
 * management. We proxy through our own edge route. The user's key lives in
 * the request body (sent via `x-shape-openai-key` header) and the server
 * forwards it without logging or persisting.
 */
const PROXY_URL = "/api/proxy/openai";

export async function* openaiChat(call: ChatCall): AsyncIterable<ChatEvent> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shape-openai-key": call.apiKey,
    },
    body: JSON.stringify({
      model: call.model,
      messages: [
        ...(call.system
          ? [{ role: "system", content: call.system }]
          : []),
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
    throw new Error(`OpenAI ${res.status}: ${errText}`);
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

export async function pingOpenAI(
  apiKey: string,
  model: string,
): Promise<void> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shape-openai-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`OpenAI ${res.status}: ${errText}`);
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
