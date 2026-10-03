/**
 * The hosted free tier. Everything that spends money or touches identity is
 * tested here against fakes: no network, no database, no key.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  HOSTED_MODEL,
  LIMITS,
  QUOTA_MESSAGE,
  actualMicroUsd,
  periodKeys,
  readHostedConfig,
  reserveMicroUsd,
  validateHostedRequest,
  type HostedConfig,
  type HostedRequest,
} from "../lib/hosted";
import { createHostedHandler, createStatusHandler, type StreamEvent, type Streamer } from "../lib/server/hosted-handler";
import { supabaseRpc, type Rpc } from "../lib/server/supabase";
import { hmac, subjects } from "../lib/server/identity";
import { preferredProvider, providerNeedsKey, BYOK_PROVIDERS } from "../lib/providers";

const ENV = {
  SHAPE_FREE_TIER: "on",
  HOSTED_ANTHROPIC_API_KEY: "sk-ant-hosted-test",
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  QUOTA_HASH_SECRET: "pepper",
  HOSTED_MONTHLY_CAP_USD: "25",
};
const ON = readHostedConfig(ENV) as Extract<HostedConfig, { enabled: true }>;
const NOW = () => new Date("2026-10-03T12:00:00Z");
const ORIGIN = "https://shape-models.com";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/hosted/anthropic`, {
    method: "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const GOOD = { system: "Be brief.", messages: [{ role: "user", content: "Hi" }], temperature: 0.4, maxTokens: 300, model: "claude-opus-5-5" };

function fakeRpc(answers: Record<string, unknown | Error>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const a = answers[fn];
    if (a instanceof Error) throw a;
    return a as T;
  };
  return { rpc, calls };
}

function fakeStream(events: StreamEvent[], opts: { failAfter?: number } = {}) {
  const seen: { apiKey: string; request: HostedRequest }[] = [];
  const stream: Streamer = async function* ({ apiKey, request }) {
    seen.push({ apiKey, request });
    let i = 0;
    for (const e of events) {
      if (opts.failAfter !== undefined && i++ === opts.failAfter) throw new Error("overloaded");
      yield e;
    }
  };
  return { stream, seen };
}

const EVENTS: StreamEvent[] = [
  { type: "message_start", message: { usage: { input_tokens: 120, output_tokens: 1 } } },
  { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello" } },
  { type: "message_delta", delta: {}, usage: { output_tokens: 40 } },
  { type: "message_stop" },
];

// --- Config ---------------------------------------------------------------------------

test("config: off unless switched on and fully set; the cap has no default", () => {
  assert.deepEqual(readHostedConfig({}), { enabled: false, reason: "switched off" });
  assert.equal(readHostedConfig({ ...ENV, SHAPE_FREE_TIER: "yes" }).enabled, false);
  const missing = readHostedConfig({ ...ENV, HOSTED_MONTHLY_CAP_USD: "" });
  assert.equal(missing.enabled, false);
  assert.match((missing as { reason: string }).reason, /HOSTED_MONTHLY_CAP_USD/);
  assert.equal(readHostedConfig({ ...ENV, HOSTED_MONTHLY_CAP_USD: "-3" }).enabled, false);

  assert.equal(ON.enabled, true);
  assert.equal(ON.dailyCalls, 50);
  assert.equal(ON.networkCalls, 1500);
  assert.equal(ON.monthlyCapMicro, 25_000_000);
  assert.equal(ON.supabaseUrl, "https://example.supabase.co", "trailing slash trimmed");
  assert.equal((readHostedConfig({ ...ENV, HOSTED_DAILY_CALLS: "100" }) as typeof ON).dailyCalls, 100);
});

// --- Validation -------------------------------------------------------------------------

test("validation: the server rebuilds the request; the browser can't pick the model or exceed the ceiling", () => {
  const v = validateHostedRequest({ ...GOOD, maxTokens: 100_000, model: "claude-fable-5-1", stream: false, metadata: { x: 1 } });
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.equal(v.request.maxTokens, LIMITS.maxTokens);
  assert.deepEqual(Object.keys(v.request).sort(), ["maxTokens", "messages", "system", "temperature", "tools"]);

  const bad = (b: unknown) => {
    const r = validateHostedRequest(b);
    assert.equal(r.ok, false, JSON.stringify(b).slice(0, 80));
  };
  bad(null);
  bad({ ...GOOD, messages: [] });
  bad({ ...GOOD, messages: [{ role: "assistant", content: "I go first" }] });
  bad({ ...GOOD, messages: [{ role: "system", content: "x" }] });
  bad({ ...GOOD, temperature: 1.5 });
  bad({ ...GOOD, system: "x".repeat(LIMITS.maxSystemChars + 1) });
  bad({ ...GOOD, messages: Array.from({ length: LIMITS.maxMessages + 1 }, () => ({ role: "user", content: "x" })) });
  bad({ ...GOOD, tools: Array.from({ length: LIMITS.maxTools + 1 }, (_, i) => ({ name: `t${i}`, description: "d", input_schema: {} })) });
  bad({ ...GOOD, messages: [{ role: "user", content: [{ type: "image", source: {} }] }] });

  // Tool turns (Tool Bench) pass.
  const tools = validateHostedRequest({
    ...GOOD,
    messages: [
      { role: "user", content: "Book it" },
      { role: "assistant", content: [{ type: "tool_use", id: "t1", name: "book", input: { when: "noon" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "done" }] },
    ],
    tools: [{ name: "book", description: "Books a slot", input_schema: { type: "object", properties: {} } }],
  });
  assert.ok(tools.ok);
});

// --- Cost ---------------------------------------------------------------------------------

test("cost: the reservation covers the worst case; actual cost is Haiku's rate", () => {
  const v = validateHostedRequest(GOOD);
  assert.ok(v.ok);
  if (!v.ok) return;
  const reserve = reserveMicroUsd(v.request);
  // 300 output tokens at $5/M alone is 1,500 micro-dollars.
  assert.ok(reserve >= 1500);
  assert.ok(reserve >= actualMicroUsd({ inputTokens: 50, outputTokens: 300 }), "reserve ≥ any outcome within the ceiling");
  assert.equal(actualMicroUsd({ inputTokens: 1_000_000, outputTokens: 1_000_000 }), 6_000_000, "$1 in + $5 out per million");
});

test("periods reset at midnight UTC", () => {
  assert.deepEqual(periodKeys(new Date("2026-10-31T23:59:59Z")), { day: "2026-10-31", month: "2026-10-01", resetsAt: "2026-11-01T00:00:00.000Z" });
});

// --- Identity -------------------------------------------------------------------------------

test("identity: subjects are keyed hashes; the network hash changes daily", async () => {
  const a = await subjects("pepper", "abc", "203.0.113.9", "2026-10-03");
  const b = await subjects("pepper", "abc", "203.0.113.9", "2026-10-04");
  assert.match(a.visitor, /^v:[0-9a-f]{64}$/);
  assert.equal(a.visitor, b.visitor);
  assert.notEqual(a.network, b.network);
  assert.doesNotMatch(a.network, /203/);
  assert.notEqual(await hmac("pepper", "x"), await hmac("salt", "x"));
});

// --- Supabase client --------------------------------------------------------------------------

test("supabase: new secret keys go in apikey only; legacy JWT keys also as Bearer", async () => {
  const seen: Record<string, string>[] = [];
  const fetcher = (async (_url: string, init: RequestInit) => {
    seen.push(init.headers as Record<string, string>);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;
  await supabaseRpc("https://x.supabase.co", "sb_secret_abc", fetcher)("consume_quota", {});
  await supabaseRpc("https://x.supabase.co", "eyJhbGciOi.legacy", fetcher)("consume_quota", {});
  assert.equal(seen[0].apikey, "sb_secret_abc");
  assert.equal(seen[0].authorization, undefined, "an sb_secret key as a Bearer token is rejected by Supabase");
  assert.equal(seen[1].authorization, "Bearer eyJhbGciOi.legacy");
});

// --- Handler ----------------------------------------------------------------------------------

test("handler: off → 503 with a way forward; cross-origin → 403", async () => {
  const { stream } = fakeStream(EVENTS);
  const off = await createHostedHandler({ config: { enabled: false, reason: "switched off" }, rpc: null, stream })(post(GOOD));
  assert.equal(off.status, 503);
  assert.equal((await off.json()).error.message, QUOTA_MESSAGE.off);

  const { rpc } = fakeRpc({ consume_quota: { ok: true, remaining: 49 } });
  const cross = await createHostedHandler({ config: ON, rpc, stream, now: NOW })(post(GOOD, { origin: "https://evil.example" }));
  assert.equal(cross.status, 403);
});

test("handler: quota refusals say which limit, and set nothing upstream in motion", async () => {
  const { stream, seen } = fakeStream(EVENTS);
  for (const reason of ["daily", "network", "monthly"] as const) {
    const { rpc } = fakeRpc({ consume_quota: { ok: false, reason } });
    const res = await createHostedHandler({ config: ON, rpc, stream, now: NOW })(post(GOOD));
    assert.equal(res.status, 429);
    const body = await res.json();
    assert.equal(body.error.reason, reason);
    assert.equal(body.error.message, QUOTA_MESSAGE[reason]);
    assert.equal(res.headers.get("x-shape-quota-remaining"), "0");
  }
  assert.equal(seen.length, 0, "no model call when the quota says no");
});

test("handler: fails closed when the quota database can't be reached", async () => {
  const { stream, seen } = fakeStream(EVENTS);
  const { rpc } = fakeRpc({ consume_quota: new Error("project paused") });
  const res = await createHostedHandler({ config: ON, rpc, stream, now: NOW })(post(GOOD));
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error.reason, "off");
  assert.equal(seen.length, 0);
});

test("handler: streams Anthropic's events through and settles actual spend", async () => {
  const { stream, seen } = fakeStream(EVENTS);
  const { rpc, calls } = fakeRpc({ consume_quota: { ok: true, remaining: 49 }, settle_spend: null });
  const res = await createHostedHandler({ config: ON, rpc, stream, now: NOW })(post(GOOD));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  assert.equal(res.headers.get("x-shape-quota-remaining"), "49");
  assert.equal(res.headers.get("x-shape-quota-limit"), "50");
  assert.equal(res.headers.get("x-shape-model"), HOSTED_MODEL);
  assert.match(res.headers.get("set-cookie") ?? "", /^shape_vid=[0-9a-f]{32}; .*HttpOnly/);

  const text = await res.text();
  assert.match(text, /event: content_block_delta\ndata: .*"Hello"/);
  assert.equal(seen[0].apiKey, ON.anthropicKey, "Shape's key, never the browser's");
  assert.equal(seen[0].request.maxTokens, 300);

  const consume = calls.find((c) => c.fn === "consume_quota")!;
  assert.equal(consume.args.p_day, "2026-10-03");
  assert.equal(consume.args.p_month, "2026-10-01");
  assert.match(String(consume.args.p_visitor), /^v:/);
  assert.match(String(consume.args.p_network), /^n:/);
  assert.equal(consume.args.p_cap_micro, 25_000_000);

  const settle = calls.find((c) => c.fn === "settle_spend")!;
  assert.equal(settle.args.p_reserved_micro, consume.args.p_reserve_micro);
  assert.equal(settle.args.p_actual_micro, actualMicroUsd({ inputTokens: 120, outputTokens: 40 }));
});

test("handler: a returning visitor keeps their cookie", async () => {
  const { stream } = fakeStream(EVENTS);
  const { rpc } = fakeRpc({ consume_quota: { ok: true, remaining: 10 }, settle_spend: null });
  const res = await createHostedHandler({ config: ON, rpc, stream, now: NOW })(post(GOOD, { cookie: `shape_vid=${"a".repeat(32)}` }));
  assert.equal(res.headers.get("set-cookie"), null);
  await res.text();
});

test("handler: an upstream failure mid-stream is reported and still settled", async () => {
  const { stream } = fakeStream(EVENTS, { failAfter: 2 });
  const { rpc, calls } = fakeRpc({ consume_quota: { ok: true, remaining: 3 }, settle_spend: null });
  const res = await createHostedHandler({ config: ON, rpc, stream, now: NOW })(post(GOOD));
  const text = await res.text();
  assert.match(text, /event: error\ndata: .*overloaded/);
  const settle = calls.find((c) => c.fn === "settle_spend");
  assert.ok(settle, "the reservation is released even when the call fails");
  assert.equal(settle!.args.p_actual_micro, actualMicroUsd({ inputTokens: 120, outputTokens: 1 }));
});

test("handler: oversized and malformed bodies are refused before any quota is spent", async () => {
  const { stream } = fakeStream(EVENTS);
  const { rpc, calls } = fakeRpc({ consume_quota: { ok: true, remaining: 1 } });
  const handler = createHostedHandler({ config: ON, rpc, stream, now: NOW });
  assert.equal((await handler(post("x".repeat(LIMITS.maxBodyBytes + 1)))).status, 413);
  assert.equal((await handler(post("{not json"))).status, 400);
  assert.equal((await handler(post({ ...GOOD, temperature: 9 }))).status, 400);
  assert.equal(calls.length, 0);
});

// --- Status -----------------------------------------------------------------------------------

test("status: off, unreachable, and open", async () => {
  const req = new Request(`${ORIGIN}/api/hosted/status`, { headers: { "x-forwarded-for": "203.0.113.9" } });
  const off = await (await createStatusHandler({ config: { enabled: false, reason: "x" }, rpc: null, now: NOW })(req)).json();
  assert.equal(off.enabled, false);

  const down = fakeRpc({ quota_status: new Error("paused") });
  assert.equal((await (await createStatusHandler({ config: ON, rpc: down.rpc, now: NOW })(req)).json()).enabled, false);

  const up = fakeRpc({ quota_status: { used: 12, month_open: true } });
  const open = await (await createStatusHandler({ config: ON, rpc: up.rpc, now: NOW })(req)).json();
  assert.deepEqual({ enabled: open.enabled, limit: open.limit, remaining: open.remaining }, { enabled: true, limit: 50, remaining: 38 });

  const capped = fakeRpc({ quota_status: { used: 0, month_open: false } });
  assert.equal((await (await createStatusHandler({ config: ON, rpc: capped.rpc, now: NOW })(req)).json()).enabled, false);
});

// --- Provider ---------------------------------------------------------------------------------

test("provider: the free tier needs no key, isn't a BYOK provider, and ranks below a reader's own key", () => {
  assert.equal(providerNeedsKey("shape-free", null), false);
  assert.ok(!BYOK_PROVIDERS.some((p) => p.id === "shape-free"));
  assert.equal(preferredProvider({}, null, true), "shape-free");
  assert.equal(preferredProvider({}, null, false), "webllm");
  assert.equal(preferredProvider({ anthropic: "sk-ant-x" }, null, true), "anthropic");
  assert.equal(preferredProvider({}, { baseUrl: "http://localhost:1234/v1", keyless: true } as never, true), "custom");
});
