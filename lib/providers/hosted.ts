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

/** How long a call waits in the queue for a free slot before giving up. */
export const MAX_QUEUE_WAIT_MS = 5 * 60 * 1000;

/** Wait, unless the call is cancelled first. */
function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Stopped."));
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(new Error("Stopped."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export async function* hostedChat(
  call: ChatCall,
  opts: { fetcher?: typeof fetch; now?: () => number; random?: () => number; sleep?: (ms: number, signal?: AbortSignal) => Promise<void> } = {},
): AsyncIterable<ChatEvent> {
  const fetcher = opts.fetcher ?? fetch;
  const now = opts.now ?? Date.now;
  const random = opts.random ?? Math.random;
  const sleep = opts.sleep ?? pause;
  const body = JSON.stringify({
    system: call.system,
    messages: toAnthropicMessages(call.messages),
    temperature: call.temperature,
    maxTokens: call.maxTokens,
    tools: call.tools?.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })) ?? [],
    ...(call.classCall ? { class: call.classCall } : {}),
  });

  // The free tier admits a fixed number of calls at once; when it's full it
  // answers "busy" and charges nothing. Wait and try again — with jitter, so a
  // room of students doesn't retry in lockstep — for up to five minutes.
  const startedAt = now();
  let toldWaiting = false;
  let res: Response;
  let failure: { message?: string; reason?: string } | null = null;
  for (;;) {
    res = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      ...(call.signal ? { signal: call.signal } : {}),
    });
    if (res.ok) break;
    failure = null;
    try {
      failure = ((await res.json()) as { error?: { message?: string; reason?: string } }).error ?? null;
    } catch {
      /* keep the generic message */
    }
    if (res.status !== 429 || failure?.reason !== "busy") break;
    if (now() - startedAt >= MAX_QUEUE_WAIT_MS) {
      throw new Error("The free tier stayed busy for five minutes. Try again in a while, or use your own key.");
    }
    if (!toldWaiting) {
      toldWaiting = true;
      yield { type: "waiting" };
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const base = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000;
    await sleep(base + Math.floor(random() * 1500), call.signal);
  }

  // A class call reports the class's allowance, not this reader's own free runs.
  const classScope = res.headers.get("x-shape-quota-scope") === "class";
  const remaining = Number(res.headers.get("x-shape-quota-remaining"));
  const limit = Number(res.headers.get("x-shape-quota-limit"));
  if (!classScope && Number.isFinite(remaining) && Number.isFinite(limit) && limit > 0) noteHostedQuota(remaining, limit);

  if (!res.ok) {
    const message = failure?.message ?? `Free tier error (${res.status}).`;
    const reason = failure?.reason;
    if (!classScope && (reason === "daily" || reason === "monthly" || reason === "off" || reason === "network")) closeHosted();
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
