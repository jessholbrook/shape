import type { ChatCall, ChatEvent } from "./types";
import {
  openAiCompatibleChat,
  pingOpenAiCompatible,
  type OpenAiCompatConfig,
} from "./openai-compatible";

/**
 * OpenAI's API is blocked from direct browser calls by Cloudflare bot
 * management, so we proxy through our own edge route. The user's key rides in
 * the `x-shape-openai-key` header and the server forwards it without logging
 * or persisting. Streaming + parsing are the shared OpenAI-compatible path.
 */
const CONFIG: OpenAiCompatConfig = {
  proxyUrl: "/api/proxy/openai",
  keyHeader: "x-shape-openai-key",
  label: "OpenAI",
};

export function openaiChat(call: ChatCall): AsyncIterable<ChatEvent> {
  return openAiCompatibleChat(call, CONFIG);
}

export function pingOpenAI(apiKey: string, model: string): Promise<void> {
  return pingOpenAiCompatible(apiKey, model, CONFIG);
}
