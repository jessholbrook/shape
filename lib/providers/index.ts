import type { ProviderId } from "../providers";
import { PROVIDERS } from "../providers";
import { anthropicChat, pingAnthropic } from "./anthropic";
import { openaiChat, pingOpenAI } from "./openai";
import { webllmChat } from "./webllm";
import type { ChatCall, ChatEvent } from "./types";

export type { ChatCall, ChatEvent, ChatMessage, ChatUsage } from "./types";

function dispatch(call: ChatCall): AsyncIterable<ChatEvent> {
  if (call.provider === "webllm") return webllmChat(call);
  if (call.provider === "anthropic") return anthropicChat(call);
  return openaiChat(call);
}

export async function* runChat(call: ChatCall): AsyncIterable<ChatEvent> {
  let sentDone = false;
  try {
    for await (const event of dispatch(call)) {
      if (event.type === "done") sentDone = true;
      yield event;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: "error", message };
    return;
  }
  if (!sentDone) {
    yield { type: "done", usage: { inputTokens: 0, outputTokens: 0 } };
  }
}

export type TestResult = { ok: true } | { ok: false; reason: string };

export async function testConnection(
  providerId: ProviderId,
  apiKey: string,
): Promise<TestResult> {
  if (providerId === "webllm") return { ok: true };
  const provider = PROVIDERS[providerId];
  const defaultModel = provider.defaultModel;
  try {
    if (providerId === "anthropic") {
      await pingAnthropic(apiKey, defaultModel);
    } else {
      await pingOpenAI(apiKey, defaultModel);
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: message };
  }
}
