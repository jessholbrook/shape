/**
 * The free tier's queue, from the browser's side: a "busy" answer is waited
 * out and retried, with jitter, for up to five minutes; anything else fails
 * straight away. Fakes only — no network, no timers.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hostedChat, MAX_QUEUE_WAIT_MS } from "../lib/providers/hosted";
import type { ChatCall, ChatEvent } from "../lib/providers/types";

const CALL: ChatCall = { provider: "shape-free", model: "claude-haiku-4-5", system: "s", messages: [{ role: "user", content: "hi" }], temperature: 0 };

const sse = (events: object[]) => events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
const ANSWER = sse([
  { type: "message_start", message: { usage: { input_tokens: 5, output_tokens: 1 } } },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } },
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2 } },
  { type: "message_stop" },
]);
const ok = () => new Response(ANSWER, { status: 200, headers: { "content-type": "text/event-stream" } });
const busy = () => new Response(JSON.stringify({ error: { message: "busy", reason: "busy" } }), { status: 429, headers: { "retry-after": "2" } });

async function run(responses: (() => Response)[], opts: { now?: () => number; signal?: AbortSignal } = {}) {
  const sleeps: number[] = [];
  let fetches = 0;
  const events: ChatEvent[] = [];
  let thrown: Error | null = null;
  try {
    for await (const e of hostedChat(opts.signal ? { ...CALL, signal: opts.signal } : CALL, {
      fetcher: (async () => responses[Math.min(fetches++, responses.length - 1)]()) as typeof fetch,
      now: opts.now ?? (() => 0),
      random: () => 0.5,
      sleep: async (ms) => void sleeps.push(ms),
    })) {
      events.push(e);
    }
  } catch (err) {
    thrown = err as Error;
  }
  return { events, sleeps, fetches, thrown };
}

test("busy, busy, then a slot: says it's waiting once, retries after retry-after plus jitter, then answers", async () => {
  const r = await run([busy, busy, ok]);
  assert.equal(r.thrown, null);
  assert.equal(r.fetches, 3);
  assert.deepEqual(r.sleeps, [2750, 2750], "2s from retry-after, plus 0.5 × 1.5s jitter");
  assert.deepEqual(r.events.filter((e) => e.type === "waiting").length, 1, "told once, not per retry");
  assert.equal(r.events[0].type, "waiting");
  assert.ok(r.events.some((e) => e.type === "text" && e.delta === "Hello"));
});

test("no queue when there's a slot: no waiting event, no sleep", async () => {
  const r = await run([ok]);
  assert.equal(r.fetches, 1);
  assert.deepEqual(r.sleeps, []);
  assert.equal(r.events.some((e) => e.type === "waiting"), false);
});

test("still busy after five minutes: gives up with words a person can act on", async () => {
  let t = 0;
  const r = await run([busy], { now: () => (t += MAX_QUEUE_WAIT_MS / 3) });
  assert.match(r.thrown!.message, /stayed busy for five minutes/);
  assert.ok(r.fetches >= 2 && r.fetches <= 4);
});

test("other refusals aren't queued: a spent daily allowance fails at once", async () => {
  const daily = () => new Response(JSON.stringify({ error: { message: "You've used today's free runs.", reason: "daily" } }), { status: 429 });
  const r = await run([daily, ok]);
  assert.equal(r.fetches, 1);
  assert.deepEqual(r.sleeps, []);
  assert.match(r.thrown!.message, /today's free runs/);
});

test("stopping while queued ends the wait", async () => {
  const ac = new AbortController();
  ac.abort();
  const events: ChatEvent[] = [];
  await assert.rejects(async () => {
    for await (const e of hostedChat({ ...CALL, signal: ac.signal }, { fetcher: (async () => busy()) as typeof fetch, now: () => 0 })) events.push(e);
  }, /Stopped/);
  assert.deepEqual(events.map((e) => e.type), ["waiting"]);
});
