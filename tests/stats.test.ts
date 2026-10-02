/**
 * Reference checks for lib/stats.ts. Every expected value comes from an
 * independent source — a published worked example or a hand computation
 * shown inline — not from running this code. A stats helper that agrees
 * with itself proves nothing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cohenH,
  effectLabel,
  hedgesG,
  meanPairwiseDistance,
  meanSd,
  newcombeDiff,
  tQuantile975,
  welchDiff,
  wilson,
} from "../lib/stats";

const near = (actual: number, expected: number, tol = 5e-4, msg?: string) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ""} expected ${expected}, got ${actual}`);

test("wilson: textbook values, and the edges stay inside [0, 1]", () => {
  const w = wilson(7, 10);
  near(w.p, 0.7);
  near(w.lo, 0.3968);
  near(w.hi, 0.8922);

  // 0/n is where Wald collapses to [0, 0]; Wilson still admits real uncertainty.
  const zero = wilson(0, 10);
  assert.equal(zero.lo, 0);
  near(zero.hi, 0.2775);

  const all = wilson(10, 10);
  assert.equal(all.hi, 1);
  near(all.lo, 0.7225);

  assert.deepEqual(wilson(0, 0), { p: 0, lo: 0, hi: 1 });
});

test("newcombeDiff matches Newcombe (1998), Table II example", () => {
  // 56/70 vs 48/80: difference 0.2000, 95% CI 0.0524 to 0.3339 (method 10).
  // Baseline first, so the 48/80 arm goes first to get a positive difference.
  const d = newcombeDiff(48, 80, 56, 70);
  near(d.diff, 0.2);
  near(d.lo, 0.0524);
  near(d.hi, 0.3339);

  // Swapping arms flips the sign and mirrors the interval.
  const back = newcombeDiff(56, 70, 48, 80);
  near(back.diff, -0.2);
  near(back.lo, -0.3339);
  near(back.hi, -0.0524);
});

test("cohenH and its plain-language label", () => {
  // 2·asin(√0.8) − 2·asin(√0.5) = 2.2143 − 1.5708
  near(cohenH(0.5, 0.8), 0.6435);
  near(cohenH(0.8, 0.5), -0.6435);
  assert.equal(cohenH(0.3, 0.3), 0);

  assert.equal(effectLabel(0.19), "negligible");
  assert.equal(effectLabel(0.2), "small");
  assert.equal(effectLabel(-0.5), "medium");
  assert.equal(effectLabel(0.8), "large");
});

test("tQuantile975 follows the t table and falls back to z", () => {
  near(tQuantile975(1), 12.706, 1e-9);
  near(tQuantile975(10), 2.228, 1e-9);
  near(tQuantile975(30), 2.042, 1e-9);
  near(tQuantile975(1000), 1.96, 1e-3);
  // Fractional Welch df land between rows.
  const t = tQuantile975(8.5);
  assert.ok(t < 2.306 && t > 2.262, `t(8.5) = ${t} should sit between t(8) and t(9)`);
  // Degenerate df never explode.
  assert.equal(tQuantile975(0), 12.706);
});

test("meanSd uses the sample (n − 1) deviation", () => {
  const s = meanSd([2, 4, 4, 4, 5, 5, 7, 9]);
  near(s.mean, 5);
  near(s.sd, 2.1381); // √(32/7)
  assert.deepEqual(meanSd([]), { mean: 0, sd: 0, n: 0 });
  assert.deepEqual(meanSd([3]), { mean: 3, sd: 0, n: 1 });
});

test("welchDiff and hedgesG on a hand-computed pair", () => {
  // a = 1..5, b = 3..7: means 3 and 5, both variances 2.5.
  // se = √(2.5/5 + 2.5/5) = 1; df = 1 / (0.25/4 + 0.25/4) = 8; t(8) = 2.306.
  const a = [1, 2, 3, 4, 5];
  const b = [3, 4, 5, 6, 7];
  const w = welchDiff(a, b)!;
  near(w.diff, 2);
  near(w.df, 8);
  near(w.lo, -0.306);
  near(w.hi, 4.306);

  // d = 2 / √2.5 = 1.2649; J = 1 − 3/(4·10 − 9) = 0.90323; g = 1.1425.
  near(hedgesG(a, b)!, 1.1425);

  assert.equal(welchDiff([1], b), null, "one value has no variance to speak of");
  assert.equal(hedgesG([1], b), null);
  assert.deepEqual(welchDiff([2, 2], [2, 2]), { diff: 0, lo: 0, hi: 0, df: 2 });
  assert.equal(hedgesG([2, 2], [2, 2]), 0);
  assert.equal(hedgesG([2, 2], [3, 3]), null, "no spread but different means: g is undefined");
});

test("meanPairwiseDistance: identical runs are 0, disjoint runs are 1", () => {
  assert.equal(meanPairwiseDistance(["the cat sat", "The cat, sat!"]), 0);
  assert.equal(meanPairwiseDistance(["alpha beta", "gamma delta"]), 1);
  // {a,b} vs {a,c}: Jaccard 1/3, distance 2/3.
  near(meanPairwiseDistance(["a b", "a c"])!, 2 / 3);
  assert.equal(meanPairwiseDistance(["only one"]), null);
});
