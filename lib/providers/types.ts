import type { ProviderId } from "../providers";

/**
 * A tool call the model made, provider-agnostic. `args` is the raw JSON text
 * as the model produced it — the arguments are not the lesson in Tool Bench,
 * and keeping them as text means a malformed call is still a call.
 */
export type ToolCall = {
  id: string;
  name: string;
  args: string;
};

/** The JSON-schema subset every provider's tool API accepts. */
export type ToolParameters = {
  type: "object";
  properties: Record<string, { type: string; description?: string }>;
  required?: string[];
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: ToolParameters;
};

export type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  /** A tool's result, fed back so the model can continue. */
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type ChatCall = {
  provider: ProviderId;
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
  /** Required for BYOK providers (Anthropic, OpenAI). Ignored for `webllm`. */
  apiKey?: string;
  /** Native tool definitions. Not supported by the in-browser models. */
  tools?: ToolSpec[];
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ChatEvent =
  | { type: "text"; delta: string }
  /** A complete tool call, once its arguments have finished streaming. */
  | { type: "tool_call"; call: ToolCall }
  | { type: "done"; usage: ChatUsage }
  | { type: "error"; message: string };

/** Parse a tool call's argument text, tolerating the empty and the malformed. */
export function parseToolArgs(args: string): Record<string, unknown> {
  if (!args.trim()) return {};
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : { value: parsed };
  } catch {
    return { raw: args };
  }
}
