import type { ChatCall, ChatEvent } from "./types";
import {
  openAiCompatibleChat,
  pingOpenAiCompatible,
  type OpenAiCompatConfig,
} from "./openai-compatible";

/**
 * Cerebras Inference — an OpenAI-compatible API known for very high tokens/sec,
 * useful for speed comparisons in Diff Mode. Proxied through our edge route
 * (like OpenAI) rather than called directly, since we don't control its CORS
 * behavior; the key rides in `x-shape-cerebras-key`, used once and never
 * logged or stored.
 */
const CONFIG: OpenAiCompatConfig = {
  proxyUrl: "/api/proxy/cerebras",
  keyHeader: "x-shape-cerebras-key",
  label: "Cerebras",
};

export function cerebrasChat(call: ChatCall): AsyncIterable<ChatEvent> {
  return openAiCompatibleChat(call, CONFIG);
}

export function pingCerebras(apiKey: string, model: string): Promise<void> {
  return pingOpenAiCompatible(apiKey, model, CONFIG);
}
