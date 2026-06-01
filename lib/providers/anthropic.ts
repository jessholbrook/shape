import type { ChatCall, ChatEvent } from "./types";
import { readSse } from "./sse";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export async function* anthropicChat(call: ChatCall): AsyncIterable<ChatEvent> {
  if (!call.apiKey) {
    throw new Error("Anthropic provider requires an API key.");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": call.apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: call.model,
      max_tokens: call.maxTokens ?? 1024,
      system: call.system || undefined,
      messages: call.messages,
      temperature: call.temperature,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  let inputTokens = 0;
  let outputTokens = 0;

  for await (const { data } of readSse(res)) {
    let parsed: AnthropicSseData;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }

    if (parsed.type === "message_start") {
      inputTokens = parsed.message?.usage?.input_tokens ?? inputTokens;
      outputTokens = parsed.message?.usage?.output_tokens ?? outputTokens;
    } else if (
      parsed.type === "content_block_delta" &&
      parsed.delta?.type === "text_delta" &&
      typeof parsed.delta.text === "string"
    ) {
      yield { type: "text", delta: parsed.delta.text };
    } else if (parsed.type === "message_delta") {
      if (parsed.usage?.output_tokens != null) {
        outputTokens = parsed.usage.output_tokens;
      }
    }
  }

  yield { type: "done", usage: { inputTokens, outputTokens } };
}

export async function pingAnthropic(
  apiKey: string,
  model: string,
): Promise<void> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Anthropic ${res.status}: ${errText}`);
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

type AnthropicSseData = {
  type: string;
  message?: {
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  delta?: { type?: string; text?: string };
  usage?: { output_tokens?: number };
};
