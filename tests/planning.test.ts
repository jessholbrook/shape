/**
 * The sample-size planner: textbook values for the statistics, and what the
 * lab tells someone before they run.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { answersForMeans, answersForRates, detectableRateChange, detectableShift } from "../lib/stats";
import { planFor, target } from "../lib/planning";
import { starterExperiment } from "../lib/experiment";

test("rates: matches the two-proportion formula (95% two-sided, 80% power)", () => {
  // 50% → 65%: the classic ~170 per group (no continuity correction).
  assert.equal(answersForRates(0.5, 0.65), 170);
  // 50% → 60%: (1.96·√0.495 + 0.8416·√0.49)² / 0.01 = 387.3.
  assert.equal(answersForRates(0.5, 0.6), 388); // pooled variance under the null; the unpooled variant gives 385
  // Direction doesn't matter.
  assert.equal(answersForRates(0.65, 0.5), 170);
  assert.equal(answersForRates(0.5, 0.5), null, "no change, nothing to detect");
  assert.equal(answersForRates(0.5, 1.2), null);
});

test("rates: what n answers can see is the inverse — and small samples only see big changes", () => {
  assert.equal(detectableRateChange(170), 15);
  assert.equal(detectableRateChange(388), 10);
  assert.equal(detectableRateChange(387), 11, "one short of 10 points");
  const lab = detectableRateChange(60)!;
  assert.ok(lab >= 24 && lab <= 26, `a full lab run (60 per version) sees ~25 points, got ${lab}`);
  assert.ok(detectableRateChange(5)! > 45 || detectableRateChange(5) === null, "five answers see almost nothing");
  const seen = (n: number) => detectableRateChange(n) ?? Infinity; // null: nothing up to 50 points
  for (let n = 10; n < 400; n += 37) assert.ok(seen(n + 37) <= seen(n), "more answers, smaller detectable change");
  assert.equal(detectableRateChange(10), null, "ten answers can't reliably see even a 50-point change");
  assert.equal(detectableRateChange(0), null);
});

test("means: Cohen's classic table (d = 0.5 → 64, d = 0.8 → 26 per group)", () => {
  assert.equal(answersForMeans(0.5), 64);
  assert.equal(answersForMeans(0.8), 26);
  assert.equal(answersForMeans(0), null);
  assert.ok(Math.abs(detectableShift(64)! - 0.495) < 0.01);
  assert.equal(detectableShift(1), null);
});

test("plan: the sample is runs per cell × items, and targets say what it would take", () => {
  const e = starterExperiment({ provider: "shape-free", model: "claude-haiku-4-5" }, 1);
  const plan = planFor(e, 10);
  assert.equal(plan.items, e.items.length);
  assert.equal(plan.perVersion, 10 * e.items.length);
  assert.equal(plan.hasRates, true, "the starter has a yes/no judge");
  assert.equal(plan.hasNumeric, true, "and a length measure");

  const t15 = target(plan, 15, 10)!;
  assert.equal(t15.needed, 170);
  assert.equal(t15.runsPerCell, Math.ceil(170 / e.items.length));
  assert.equal(t15.fits, false, "beyond the lab's cap of 10");
  assert.equal(t15.runsNeeded, Math.ceil(170 / plan.perVersion), "students' worth in a class");

  const t30 = target(planFor(e, 10), 30, 10)!;
  assert.equal(t30.fits, Math.ceil(t30.needed / e.items.length) <= 10);

  const noItems = planFor({ items: [], measures: e.measures }, 5);
  assert.equal(noItems.items, 1, "no items still means one prompt per version");
  assert.equal(noItems.perVersion, 5);
});
