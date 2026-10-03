import Anthropic from "@anthropic-ai/sdk";
import { HOSTED_MODEL } from "../hosted";
import type { Streamer, StreamEvent } from "./hosted-handler";

/**
 * The real streamer: Claude Haiku 4.5 through the official SDK, on Shape's
 * key. Yields the SDK's raw stream events unchanged, so the browser parses
 * them with the same code it uses for a reader's own Anthropic key.
 *
 * The model and token ceiling come from the validated request, never the
 * browser. Haiku 4.5 still takes `temperature` (newer models dropped it),
 * which the playgrounds depend on.
 */
export const anthropicStream: Streamer = async function* ({ apiKey, request, signal }) {
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  const stream = client.messages.stream(
    {
      model: HOSTED_MODEL,
      max_tokens: request.maxTokens,
      ...(request.system ? { system: request.system } : {}),
      messages: request.messages as Anthropic.MessageParam[],
      temperature: request.temperature,
      ...(request.tools.length ? { tools: request.tools as Anthropic.Tool[] } : {}),
    },
    { signal },
  );
  for await (const event of stream) {
    yield event as unknown as StreamEvent;
  }
};
