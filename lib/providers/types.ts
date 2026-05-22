import type { ProviderId } from "../providers";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatCall = {
  provider: ProviderId;
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
  apiKey: string;
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "done"; usage: ChatUsage }
  | { type: "error"; message: string };
