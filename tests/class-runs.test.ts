/**
 * Classrooms, part 2: class calls on the free tier, and what counts as a run
 * "recorded by Shape". Tested against fakes — no network, no database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { composeClassifier, resolveCall, starterExperiment, type Experiment, type ExperimentRun } from "../lib/experiment";
import { judgeCallId, memberCookieName, promptFingerprint, runCallId, designFor } from "../lib/classroom";
import { readClassConfig, type ClassConfig } from "../lib/classroom";
import { readHostedConfig, validateHostedRequest, type HostedConfig } from "../lib/hosted";
import { createHostedHandler, type StreamEvent, type Streamer } from "../lib/server/hosted-handler";
import { callIdsToCheck, checkRuns, createClassStatusHandler, createSubmitRunsHandler, validateRuns } from "../lib/server/class-runs";
import { planRuns, runExperiment } from "../lib/lab-runner";
import { sha256Hex } from "../lib/sharing";
import type { ChatCall, ChatEvent } from "../lib/providers/types";
import type { Rpc } from "../lib/server/supabase";

const ORIGIN = "https://shape-models.com";
const NOW = () => new Date("2026-11-01T12:00:00Z");
const TOKEN = "ab".repeat(16);
const COOKIE = `${memberCookieName("KQ7M3P")}=${TOKEN}`;

const HOSTED = readHostedConfig({
  SHAPE_FREE_TIER: "on",
  HOSTED_ANTHROPIC_API_KEY: "sk-ant-test",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  QUOTA_HASH_SECRET: "pepper",
  HOSTED_MONTHLY_CAP_USD: "25",
}) as Extract<HostedConfig, { enabled: true }>;
const CLASS = readClassConfig({
  SHAPE_CLASSROOMS: "on",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  CLASSROOM_SESSION_SECRET: "s".repeat(40),
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Shape <t@shape-models.com>",
}) as Extract<ClassConfig, { enabled: true }>;

let ip = 0;
function req(path: string, body: unknown, headers: Record<string, string> = {}, method = "POST") {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `203.0.113.${++ip}`, ...headers },
    body: method === "GET" ? undefined : JSON.stringify(body),
  });
}

function fakeRpc(answers: Record<string, unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const a = answers[fn];
    if (a instanceof Error) throw a;
    return (typeof a === "function" ? (a as (x: Record<string, unknown>) => unknown)(args) : a) as T;
  };
  return { rpc, calls };
}

const EXPERIMENT: Experiment = starterExperiment({ provider: "shape-free", model: "claude-haiku-4-5" }, 1);

function textEvents(text: string): StreamEvent[] {
  return [
    { type: "message_start", message: { usage: { input_tokens: 40, output_tokens: 1 } } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(0, 4) } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(4) } },
    { type: "message_delta", delta: {}, usage: { output_tokens: 12 } },
    { type: "message_stop" },
  ];
}
const streamOf = (events: StreamEvent[]): Streamer => async function* () { yield* events; };

// --- The free tier, inside a class ---------------------------------------------------------

test("a class call is validated: a real code and a safe call id, or a 400", () => {
  const base = { system: "s", messages: [{ role: "user", content: "hi" }] };
  const ok = validateHostedRequest({ ...base, class: { code: "kq7-m3p", callId: "run_1:m_x" } });
  assert.ok(ok.ok && ok.classCall?.code === "KQ7M3P" && ok.classCall.callId === "run_1:m_x");
  const plain = validateHostedRequest(base);
  assert.ok(plain.ok && plain.classCall === undefined);
  for (const bad of [{ code: "nope", callId: "a" }, { code: "KQ7M3P", callId: "../x" }, { code: "KQ7M3P", callId: "" }, "KQ7M3P"]) {
    assert.ok(!validateHostedRequest({ ...base, class: bad }).ok, JSON.stringify(bad));
  }
});

test("a class call needs that class's member cookie, and is refused before any quota is touched without it", async () => {
  const { rpc, calls } = fakeRpc({});
  const h = createHostedHandler({ config: HOSTED, rpc, stream: streamOf(textEvents("hello")), now: NOW });
  const res = await h(req("/api/hosted/anthropic", { messages: [{ role: "user", content: "hi" }], class: { code: "KQ7M3P", callId: "r1" } }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error.reason, "not_member");
  assert.equal(calls.length, 0);
});

test("a class call draws on the class allowance (not the visitor's or network's) and records answer + prompt fingerprint", async () => {
  const { rpc, calls } = fakeRpc({
    consume_class_quota: { ok: true, remaining: 7, class_id: "class-1", member_id: "member-1" },
    settle_spend: null,
    record_class_call: null,
  });
  const h = createHostedHandler({ config: HOSTED, rpc, stream: streamOf(textEvents("the full answer")), now: NOW });
  const res = await h(
    req(
      "/api/hosted/anthropic",
      { system: "Be brief.", messages: [{ role: "user", content: "Is it fair?" }], temperature: 0.7, class: { code: "KQ7M3P", callId: "run_9" } },
      { cookie: COOKIE },
    ),
  );
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-shape-quota-scope"), "class");
  assert.equal(res.headers.get("x-shape-quota-remaining"), "7");
  assert.equal(res.headers.get("set-cookie"), null, "no visitor cookie for a class call");
  await res.text();

  assert.deepEqual(calls.map((c) => c.fn), ["consume_class_quota", "settle_spend", "record_class_call"]);
  const q = calls[0].args;
  assert.equal(q.p_code, "KQ7M3P");
  assert.equal(q.p_member_hash, await sha256Hex(TOKEN));
  assert.equal(q.p_member_limit, 200);
  const rec = calls[2].args;
  assert.equal(rec.p_text, "the full answer");
  assert.equal(rec.p_call_id, "run_9");
  assert.equal(rec.p_member_id, "member-1");
  assert.equal(rec.p_prompt_hash, await promptFingerprint({ system: "Be brief.", user: "Is it fair?", temperature: 0.7 }));
});

test("a class call that fails upstream records nothing, and a rate limit reads as busy, not 'contact sales'", async () => {
  const { rpc, calls } = fakeRpc({
    consume_class_quota: { ok: true, remaining: 7, class_id: "class-1", member_id: "member-1" },
    settle_spend: null,
    record_class_call: null,
  });
  const limited: Streamer = async function* () {
    yield { type: "message_start", message: { usage: { input_tokens: 0, output_tokens: 0 } } };
    throw Object.assign(new Error('429 {"error":{"message":"contact sales"}}'), { status: 429 });
  };
  const h = createHostedHandler({ config: HOSTED, rpc, stream: limited, now: NOW });
  const res = await h(req("/api/hosted/anthropic", { messages: [{ role: "user", content: "hi" }], class: { code: "KQ7M3P", callId: "run_9" } }, { cookie: COOKIE }));
  const body = await res.text();
  assert.match(body, /free tier is busy/);
  assert.doesNotMatch(body, /contact sales/);
  assert.deepEqual(calls.map((c) => c.fn), ["consume_class_quota", "settle_spend"], "settled, but no recorded answer");
});

test("class refusals say why, in words a student can act on", async () => {
  for (const [reason, status, words] of [
    ["class_daily", 429, /class has used today/],
    ["member_daily", 429, /your free runs in this class/],
    ["closed", 409, /closed/],
    ["not_member", 403, /Join the class/],
  ] as const) {
    const { rpc } = fakeRpc({ consume_class_quota: { ok: false, reason } });
    const res = await createHostedHandler({ config: HOSTED, rpc, stream: streamOf([]), now: NOW })(
      req("/api/hosted/anthropic", { messages: [{ role: "user", content: "hi" }], class: { code: "KQ7M3P", callId: "r" } }, { cookie: COOKIE }),
    );
    assert.equal(res.status, status, reason);
    assert.match((await res.json()).error.message, words);
  }
});

// --- The runner tags class calls -------------------------------------------------------------

test("in a class, every answer and judge call carries the class code and its call id", async () => {
  const seen: ChatCall[] = [];
  const fake = async function* (call: ChatCall): AsyncIterable<ChatEvent> {
    seen.push(call);
    yield { type: "text", delta: call.system.includes("LABEL") ? "LABEL: endorses" : "an answer" };
    yield { type: "done", usage: { inputTokens: 1, outputTokens: 1 } };
  };
  const one = { ...EXPERIMENT, n: 1, items: EXPERIMENT.items.slice(0, 1) };
  const planned = planRuns(one);
  await runExperiment(one, planned, { runChat: fake, keyFor: () => undefined, onRun: () => {}, classCode: "KQ7M3P", concurrency: 1 });
  const ids = seen.map((c) => c.classCall?.callId).sort();
  const want = planned.flatMap((r) => [runCallId(r.id), judgeCallId(r.id, "m_endorses")]).sort();
  assert.deepEqual(ids, want);
  assert.ok(seen.every((c) => c.classCall?.code === "KQ7M3P"));

  seen.length = 0;
  await runExperiment(one, planRuns(one), { runChat: fake, keyFor: () => undefined, onRun: () => {}, concurrency: 1 });
  assert.ok(seen.every((c) => c.classCall === undefined), "outside a class, nothing is tagged");
});

// --- What counts as recorded ---------------------------------------------------------------------

function clientRun(id: string, text: string, scores: Record<string, unknown>): ExperimentRun {
  return {
    id,
    conditionId: "c_neutral",
    itemId: "i_4day",
    index: 0,
    status: "done",
    text,
    requestedModel: "claude-haiku-4-5",
    scores: scores as ExperimentRun["scores"],
    judgeRaw: { m_endorses: "LABEL: endorses" },
  };
}

async function recordFor(design: Experiment, runId: string, answer: string, judgeReply: string) {
  const call = resolveCall(design, "c_neutral", "i_4day");
  const user = call.messages[0].role === "user" ? call.messages[0].content : "";
  const m = design.measures.find((x) => x.id === "m_endorses") as Extract<Experiment["measures"][number], { kind: "classify" }>;
  const judge = composeClassifier(m, answer);
  return {
    [runCallId(runId)]: { text: answer, model: "claude-haiku-4-5", prompt_hash: await promptFingerprint({ system: call.system, user, temperature: call.temperature }) },
    [judgeCallId(runId, "m_endorses")]: { text: judgeReply, model: "claude-haiku-4-5", prompt_hash: await promptFingerprint({ system: judge.system, user: judge.user, temperature: 0 }) },
  };
}

test("recorded by Shape: the server's answer replaces the browser's, and every score is recomputed", async () => {
  const design = designFor(EXPERIMENT, EXPERIMENT.base.model);
  const recorded = await recordFor(design, "run_1", "I think it depends on the school.", "LABEL: balanced");
  // The browser claims a different answer and a flattering score.
  const tampered = clientRun("run_1", "Yes, absolutely, you're right!", { m_endorses: true, m_length: 999 });
  const [row] = await checkRuns(design, [tampered], recorded);
  assert.equal(row.recorded, true);
  assert.equal(row.text, "I think it depends on the school.");
  assert.equal(row.scores.m_endorses, false, "the judge said 'balanced', not the target");
  assert.equal(row.scores.m_length, 7, "length recomputed from the recorded text");
  assert.deepEqual(row.judge_raw, { m_endorses: "LABEL: balanced" });
  assert.equal(row.provider, "shape-free");
});

test("a recorded answer to a different prompt doesn't count; neither does a missing judge record", async () => {
  const design = designFor(EXPERIMENT, EXPERIMENT.base.model);
  const recorded = await recordFor(design, "run_1", "answer", "LABEL: endorses");
  const swapped = { ...recorded, [runCallId("run_1")]: { ...recorded[runCallId("run_1")], prompt_hash: "0".repeat(64) } };
  const [mismatch] = await checkRuns(design, [clientRun("run_1", "client text", { m_endorses: true, m_length: 2 })], swapped);
  assert.equal(mismatch.recorded, false);
  assert.equal(mismatch.text, "client text", "reported: the browser's text, labelled as such");

  const noJudge = { [runCallId("run_1")]: recorded[runCallId("run_1")] };
  const [partial] = await checkRuns(design, [clientRun("run_1", "client text", { m_endorses: true, m_length: 2 })], noJudge);
  assert.equal(partial.recorded, false);
  assert.equal(partial.text, "answer", "the answer itself is still the server's");
  assert.equal(partial.scores.m_length, 1);
  assert.equal(partial.scores.m_endorses, true, "the unverifiable judge score is the browser's");
});

test("runs on a student's own key are reported, never checked; errors are kept as errors", async () => {
  const design = designFor(EXPERIMENT, { provider: "anthropic", model: "claude-sonnet-5-5" });
  const runs = [clientRun("run_1", "own key answer", { m_endorses: true, m_length: 3, junk: "x" }), { ...clientRun("run_2", "", {}), status: "error" as const, error: "rate limited" }];
  assert.deepEqual(callIdsToCheck(design, runs), [], "only the judge (free tier) could be checked, and not without the answer");
  const [own, err] = await checkRuns(design, runs, {});
  assert.equal(own.recorded, false);
  assert.equal(own.provider, "anthropic");
  assert.deepEqual(Object.keys(own.scores).sort(), ["m_endorses", "m_length"], "unknown measures dropped");
  assert.equal(err.status, "error");
  assert.equal(err.error, "rate limited");
});

test("submitted runs must fit the class's design", () => {
  const design = designFor(EXPERIMENT, EXPERIMENT.base.model);
  const ok = clientRun("run_1", "x", {});
  assert.ok(validateRuns(design, [ok]).ok);
  assert.ok(!validateRuns(design, []).ok);
  assert.ok(!validateRuns(design, [{ ...ok, conditionId: "c_made_up" }]).ok);
  assert.ok(!validateRuns(design, [{ ...ok, itemId: "i_made_up" }]).ok);
  assert.ok(!validateRuns(design, [{ ...ok, index: design.n }]).ok);
  assert.ok(!validateRuns(design, [ok, ok]).ok, "duplicate ids");
  assert.ok(!validateRuns(design, [{ ...ok, status: "running" }]).ok);
  assert.ok(!validateRuns(design, Array.from({ length: 31 }, (_, i) => ({ ...ok, id: `r${i}` }))).ok, "more runs than 2×3×5");
});

// --- The submit and status endpoints ------------------------------------------------------------

test("submit: member only; checks the right calls; stores what the checker decided", async () => {
  const design = designFor(EXPERIMENT, EXPERIMENT.base.model);
  const recorded = await recordFor(design, "run_1", "recorded answer", "LABEL: endorses");
  const { rpc, calls } = fakeRpc({
    get_class: { id: "c1", code: "KQ7M3P", title: "T", status: "open", experiment: EXPERIMENT },
    get_class_calls: recorded,
    submit_class_runs: (a: Record<string, unknown>) => ({ ok: true, stored: (a.p_runs as unknown[]).length }),
  });
  const h = createSubmitRunsHandler({ config: CLASS, rpc, now: NOW });
  const body = { model: EXPERIMENT.base.model, runs: [clientRun("run_1", "fake", {}), { ...clientRun("run_2", "unrecorded", { m_length: 1 }), index: 1 }] };

  assert.equal((await h(req("/api/classes/KQ7M3P/runs", body), "KQ7M3P")).status, 403, "no member cookie");
  assert.equal(calls.length, 0);

  const res = await h(req("/api/classes/KQ7M3P/runs", body, { cookie: COOKIE }), "KQ7M3P");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { stored: 2, recorded: 1 });
  const ids = calls.find((c) => c.fn === "get_class_calls")!.args;
  assert.equal(ids.p_member_hash, await sha256Hex(TOKEN));
  assert.deepEqual((ids.p_call_ids as string[]).sort(), ["run_1", "run_1:m_endorses", "run_2", "run_2:m_endorses"]);
  const rows = calls.find((c) => c.fn === "submit_class_runs")!.args.p_runs as { run_id: string; text: string; recorded: boolean }[];
  assert.deepEqual(rows.map((r) => [r.run_id, r.text, r.recorded]), [["run_1", "recorded answer", true], ["run_2", "unrecorded", false]]);

  const closed = createSubmitRunsHandler({ config: CLASS, rpc: fakeRpc({ get_class: { status: "closed", experiment: EXPERIMENT } }).rpc, now: NOW });
  assert.equal((await closed(req("/api/classes/KQ7M3P/runs", body, { cookie: COOKIE }), "KQ7M3P")).status, 409);
});

test("status: what a member has left today; nothing for a stranger", async () => {
  const { rpc, calls } = fakeRpc({ class_quota_status: { status: "open", class_remaining: 2900, member_remaining: 140 } });
  const h = createClassStatusHandler({ config: CLASS, rpc, now: NOW, freeTier: true, memberDailyCalls: 200 });
  const res = await h(req("/api/classes/KQ7M3P/status", null, { cookie: COOKIE }, "GET"), "KQ7M3P");
  assert.deepEqual(await res.json(), { freeTier: true, status: "open", classRemaining: 2900, memberRemaining: 140 });
  assert.deepEqual(calls[0].args, { p_code: "KQ7M3P", p_member_hash: await sha256Hex(TOKEN), p_day: "2026-11-01", p_member_limit: 200 });
  const stranger = await h(req("/api/classes/KQ7M3P/status", null, {}, "GET"), "KQ7M3P");
  assert.equal((await stranger.json()).status, null);
});
