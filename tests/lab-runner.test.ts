/**
 * The lab's run loop against a scripted runChat — no network. Covers the
 * order of events (stream → local scores → judge), how judge replies become
 * scores, where errors and unparseable judgements land, and Stop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ChatCall, ChatEvent } from "../lib/providers/types";
import { analyze, plannedCalls, starterExperiment, type Experiment, type ExperimentRun } from "../lib/experiment";
import { estimateExperimentCost, planRuns, runExperiment } from "../lib/lab-runner";

const MODEL = { provider: "anthropic" as const, model: "claude-haiku-4-5" };

async function* stream(text: string, opts: { error?: string } = {}): AsyncIterable<ChatEvent> {
  if (opts.error) {
    yield { type: "error", message: opts.error };
    yield { type: "done", usage: { inputTokens: 0, outputTokens: 0 } };
    return;
  }
  for (const word of text.split(" ")) yield { type: "text", delta: word + " " };
  yield { type: "done", usage: { inputTokens: 10, outputTokens: 20 } };
}

/**
 * Scripted model. Answers: "Yes, I endorse it." when the user stated a view,
 * a balanced reply otherwise. Judge: reads the answer and labels it — except
 * the first judged run, which gets an unparseable reply.
 */
function fakeModel(opts: { failAnswerContaining?: string } = {}) {
  const calls: ChatCall[] = [];
  let judged = 0;
  const runChat = (call: ChatCall): AsyncIterable<ChatEvent> => {
    calls.push(call);
    const user = call.messages[0]?.role === "user" ? call.messages[0].content : "";
    if (call.system.startsWith("You are a careful annotator")) {
      judged += 1;
      if (judged === 1) return stream("Hard to say really");
      return stream(user.includes("endorse it") ? "Clearly positive.\nLABEL: endorses" : "LABEL: balanced");
    }
    if (opts.failAnswerContaining && user.includes(opts.failAnswerContaining)) return stream("", { error: "rate limited" });
    return stream(user.startsWith("I'm pretty convinced") ? "Yes, I endorse it." : "There are good points on both sides.");
  };
  return { runChat, calls };
}

function collectRuns(): { onRun: (r: ExperimentRun) => void; latest: Map<string, ExperimentRun> } {
  const latest = new Map<string, ExperimentRun>();
  return { onRun: (r) => latest.set(r.id, r), latest };
}

test("every planned run finishes, scored locally and by the judge", async () => {
  const e: Experiment = starterExperiment(MODEL, 0);
  const runs = planRuns(e);
  assert.equal(runs.length, 2 * 3 * 5);
  assert.ok(runs.every((r) => r.status === "idle" && r.requestedModel === MODEL.model));

  const { runChat, calls } = fakeModel();
  const { onRun, latest } = collectRuns();
  await runExperiment(e, runs, { runChat, keyFor: () => "sk-test", onRun, concurrency: 3 });

  assert.equal(calls.length, plannedCalls(e), "one answer + one judge call per run");
  const done = [...latest.values()];
  assert.equal(done.length, 30);
  assert.ok(done.every((r) => r.status === "done"));
  assert.ok(done.every((r) => typeof r.scores.m_length === "number" && r.scores.m_length > 0));

  // Judge: views stated → endorses; neutral → balanced; one unparseable → null, with its raw reply kept.
  const nulls = done.filter((r) => r.scores.m_endorses === null);
  assert.equal(nulls.length, 1);
  assert.equal(nulls[0].judgeRaw?.m_endorses?.trim(), "Hard to say really");
  for (const r of done.filter((r) => r.scores.m_endorses !== null)) {
    assert.equal(r.scores.m_endorses, r.conditionId === "c_view");
  }

  // The judge reads with temperature 0, through the judge's own provider and key.
  const judgeCalls = calls.filter((c) => c.system.startsWith("You are a careful annotator"));
  assert.ok(judgeCalls.every((c) => c.temperature === 0 && c.apiKey === "sk-test" && c.model === MODEL.model));

  // And the analysis sees what the runner wrote.
  const a = analyze({ ...e, runs: done });
  const cmp = a.comparisons.find((c) => c.measureId === "m_endorses")!;
  assert.equal(cmp.kind, "binary");
  if (cmp.kind === "binary") {
    assert.equal(cmp.nBaseline + cmp.nCondition, 29, "the unparseable judgement is excluded, not a miss");
    assert.ok(cmp.diff.lo > 0.5);
  }
});

test("an errored answer is marked error, skips its judge, and drops out of the analysis", async () => {
  const e = starterExperiment(MODEL, 0);
  const { runChat, calls } = fakeModel({ failAnswerContaining: "nuclear" });
  const { onRun, latest } = collectRuns();
  await runExperiment(e, planRuns(e), { runChat, keyFor: () => "k", onRun, concurrency: 2 });

  const errored = [...latest.values()].filter((r) => r.status === "error");
  assert.equal(errored.length, 10, "both conditions × 5 runs of the nuclear item");
  assert.ok(errored.every((r) => r.error === "rate limited" && Object.keys(r.scores).length === 0));
  assert.equal(calls.length, 30 + 20, "no judge calls for errored answers");

  const cells = analyze({ ...e, runs: [...latest.values()] }).cells.filter((c) => c.measureId === "m_length");
  assert.ok(cells.every((c) => c.excluded === 5));
});

test("Stop: no new runs start once aborted; finished runs keep their results", async () => {
  const e = starterExperiment(MODEL, 0);
  const runs = planRuns(e);
  const controller = new AbortController();
  const { runChat } = fakeModel();
  const { onRun, latest } = collectRuns();
  let finished = 0;
  await runExperiment(e, runs, {
    runChat,
    keyFor: () => "k",
    concurrency: 1,
    signal: controller.signal,
    onRun: (r) => {
      onRun(r);
      if (r.status === "done" && ++finished === 4) controller.abort();
    },
  });
  const seen = [...latest.values()];
  assert.equal(seen.filter((r) => r.status === "done").length, 4);
  assert.equal(seen.length, 4, "nothing after the abort started");
});

test("cost estimate: call count matches the plan; in-browser runs are free", () => {
  const e = starterExperiment(MODEL, 0);
  const est = estimateExperimentCost(e);
  assert.equal(est.calls, plannedCalls(e));
  assert.equal(est.free, false);
  assert.ok(est.usd > 0 && est.usd < 1, `a 30-run Haiku experiment should cost cents, got $${est.usd}`);

  const local = { provider: "webllm" as const, model: "Llama-3.2-1B-Instruct-q4f16_1-MLC" };
  const free = estimateExperimentCost(starterExperiment(local, 0));
  assert.deepEqual([free.free, free.usd], [true, 0]);
});
