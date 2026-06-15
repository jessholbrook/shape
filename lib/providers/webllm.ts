import type { ChatCall, ChatEvent } from "./types";
import { acquireInferenceLock, getEngine } from "../webllm-engine";

/**
 * Provider adapter for in-browser inference via WebLLM. The engine is loaded
 * lazily by `getEngine()` on first use; later calls reuse the same instance.
 * Streaming follows the OpenAI chat-completions shape that WebLLM mirrors.
 *
 * Wraps the entire engine interaction in an inference lock — WebLLM's engine
 * can only run one chat completion at a time, and Diff Mode (or anything else
 * that fires two webllm calls concurrently) would otherwise race the engine
 * into "The current Object has already been disposed." The lock holds from
 * before getEngine() through the last yielded chunk, so a model reload from
 * one call can't interleave with another call's mid-stream consumption.
 */
export async function* webllmChat(call: ChatCall): AsyncIterable<ChatEvent> {
  const release = await acquireInferenceLock();

  try {
    const engine = await getEngine(call.model);

    const messages: { role: "system" | "user" | "assistant"; content: string }[] =
      [];
    if (call.system) messages.push({ role: "system", content: call.system });
    for (const m of call.messages) messages.push({ role: m.role, content: m.content });

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        stream_options: { include_usage: true },
        temperature: call.temperature,
        max_tokens: call.maxTokens ?? 1024,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield { type: "text", delta };
        }
        const usage = chunk.usage;
        if (usage) {
          if (typeof usage.prompt_tokens === "number") {
            inputTokens = usage.prompt_tokens;
          }
          if (typeof usage.completion_tokens === "number") {
            outputTokens = usage.completion_tokens;
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: "error", message };
      return;
    }

    yield { type: "done", usage: { inputTokens, outputTokens } };
  } finally {
    release();
  }
}
