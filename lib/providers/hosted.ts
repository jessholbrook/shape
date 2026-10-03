import type { ChatCall, ChatEvent } from "./types";
import { parseAnthropicStream, toAnthropicMessages } from "./anthropic";
import { readSse } from "./sse";
import { closeHosted, noteHostedQuota } from "../hooks/use-hosted-status";

/**
 * Shape's free tier, from the browser. The call goes to Shape's own server
 * (no key here, no key sent), which picks the model and token ceiling, counts
 * the call against today's quota, and streams Anthropic's events straight
 * back — parsed by the same code as a reader's own Anthropic key.
 */
const ENDPOINT = "/api/hosted/anthropic";

export async function* hostedChat(call: ChatCall): AsyncIterable<ChatEvent> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system: call.system,
      messages: toAnthropicMessages(call.messages),
      temperature: call.temperature,
      maxTokens: call.maxTokens,
      tools: call.tools?.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) ?? [],
    }),
  });

  const remaining = Number(res.headers.get("x-shape-quota-remaining"));
  const limit = Number(res.headers.get("x-shape-quota-limit"));
  if (Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) noteHostedQuota(remaining, limit);

  if (!res.ok) {
    let message = `Free tier error (${res.status}).`;
    let reason: string | undefined;
    try {
      const body = (await res.json()) as { error?: { message?: string; reason?: string } };
      message = body.error?.message ?? message;
      reason = body.error?.reason;
    } catch {
      /* keep the generic message */
    }
    if (reason === "daily" || reason === "monthly" || reason === "off" || reason === "network") closeHosted();
    throw new Error(message);
  }

  yield* parseAnthropicStream(failOnError(readSse(res)));
}

/** The server reports an upstream failure mid-stream as an `error` event; surface it. */
async function* failOnError(events: AsyncIterable<{ data: string }>): AsyncIterable<string> {
  for await (const { data } of events) {
    let parsed: { type?: string; error?: { message?: string } } | null = null;
    try {
      parsed = JSON.parse(data);
    } catch {
      /* not JSON — let the parser skip it */
    }
    if (parsed?.type === "error") throw new Error(parsed.error?.message ?? "The free tier's model call failed.");
    yield data;
  }
}
