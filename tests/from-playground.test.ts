/**
 * Playground → experiment mappings. Each must produce a valid, runnable,
 * affordable experiment that carries the reader's setup across faithfully —
 * and says so when something didn't come along.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { expandCells, plannedCalls, resolveCall, validateExperiment, type Experiment } from "../lib/experiment";
import { fromDiff, fromPortability, fromRefusal, fromSpread } from "../lib/experiments/from-playground";
import { REFUSAL_PACK } from "../lib/refusal";
import { SPREAD_PACK } from "../lib/spread";

const A = { provider: "anthropic" as const, model: "claude-haiku-4-5", system: "Be brief.", temperature: 0.3 };

function runnable(e: Experiment, maxCalls = 80) {
  const v = validateExperiment(JSON.parse(JSON.stringify(e)));
  assert.ok(v.ok, v.ok ? "" : v.reason);
  for (const { conditionId, itemId } of expandCells(e)) {
    const call = resolveCall(e, conditionId, itemId);
    const user = call.messages[0].role === "user" ? call.messages[0].content : "";
    assert.doesNotMatch(user, /\{\{/, `${conditionId}/${itemId} left a variable unfilled`);
  }
  assert.ok(plannedCalls(e) <= maxCalls, `plans ${plannedCalls(e)} calls`);
  assert.equal(e.runs.length, 0);
  assert.equal(e.hypothesisLockedAt, undefined, "the reader states the hypothesis before it locks");
}

test("Diff: B patches exactly the fields that differ", () => {
  const e = fromDiff(A, { ...A, temperature: 0.9 }, "Say hello.", { now: 0 });
  runnable(e);
  assert.deepEqual(e.conditions[1].patch, { temperature: 0.9 });
  assert.match(e.question, /the temperature/);
  assert.equal(resolveCall(e, "c_b", null).temperature, 0.9);
  assert.equal(resolveCall(e, "c_a", null).temperature, 0.3);

  const multi = fromDiff(A, { ...A, system: "Be thorough.", model: "claude-sonnet-4-6" }, "Hi", { now: 0 });
  assert.deepEqual(Object.keys(multi.conditions[1].patch).sort(), ["model", "system"]);
  assert.match(multi.question, /more than one thing/);
});

test("Diff: identical configs and conversation mode are said out loud", () => {
  const same = fromDiff(A, A, "Hi", { now: 0 });
  assert.deepEqual(same.conditions[1].patch, {});
  assert.match(same.question, /identical/);
  const convo = fromDiff(A, { ...A, temperature: 1 }, "Hi", { conversation: true, now: 0 });
  assert.match(convo.question, /earlier turns/);
});

test("Spread: complete assertions become measures; incomplete ones are dropped, not always-true", () => {
  const seed = SPREAD_PACK.core;
  const e = fromSpread(A, seed.message, [...seed.assertions, { id: "blank", kind: "contains", value: "  " }], 0);
  runnable(e);
  const assertionMeasures = e.measures.filter((m) => m.kind === "assertion");
  assert.equal(assertionMeasures.length, seed.assertions.length);
  assert.ok(e.measures.some((m) => m.kind === "length"));
  assert.equal(e.conditions[1].patch.system, A.system, "the variant starts as a copy, ready to edit");
  assert.match(e.question, /identical/);
  assert.equal(e.base.userTemplate, seed.message);
});

test("Portability: one condition per model, baseline first, each resolving to its own model", () => {
  const refs = [
    { provider: "anthropic" as const, model: "claude-haiku-4-5" },
    { provider: "openai" as const, model: "gpt-4o-mini" },
    { provider: "gemini" as const, model: "gemini-3.5-flash" },
    { provider: "webllm" as const, model: "Llama-3.2-1B-Instruct-q4f16_1-MLC" },
  ];
  const e = fromPortability(refs, "Answer in two sentences.", "Where are my photos?", 0.7, SPREAD_PACK.core.assertions, 0);
  runnable(e);
  assert.equal(e.conditions.length, 4);
  assert.deepEqual(e.conditions[0].patch, {});
  e.conditions.forEach((c, i) => assert.equal(resolveCall(e, c.id, null).model, refs[i].model));
});

test("Refusal: one item per probe with its expectation, judged for declining", () => {
  const { guidelines, probes } = REFUSAL_PACK.core;
  const model = { provider: "anthropic" as const, model: "claude-haiku-4-5" };
  const e = fromRefusal(guidelines, probes, model, 0.3, 0);
  runnable(e);
  assert.equal(e.items.length, probes.length);
  assert.match(e.items[0].label, /should (refuse|engage)/);
  assert.equal(resolveCall(e, "c_original", e.items[0].id).messages[0].content, probes[0].userMessage);
  const judge = e.measures[0];
  assert.equal(judge.kind, "classify");
  if (judge.kind === "classify") {
    assert.ok(judge.question.trim() && judge.labels.includes(judge.target));
    assert.deepEqual(judge.judge, model);
  }
  // Policy and philosophy packs map too.
  runnable(fromRefusal(REFUSAL_PACK.policy!.guidelines, REFUSAL_PACK.policy!.probes, model, 0.3, 0));
});

test("Portability labels conditions with readable model names", () => {
  const e = fromPortability(
    [{ provider: "webllm", model: "Llama-3.2-1B-Instruct-q4f16_1-MLC" }, { provider: "anthropic", model: "not-in-catalog" }],
    "s", "m", 0.7, [], 0,
  );
  assert.equal(e.conditions[0].label, "Llama 3.2 1B");
  assert.equal(e.conditions[1].label, "not-in-catalog", "unknown models fall back to their id");
});
