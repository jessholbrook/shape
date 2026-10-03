import { jaccard, tokenSet } from "./spread";

/**
 * Small-sample statistics for the experiment lab.
 *
 * Experiments here run 3–10 samples per cell, which is exactly where the
 * textbook normal approximations fall apart: a Wald interval on 0/5 is
 * [0, 0], which claims certainty from five tries. So proportions use Wilson
 * score intervals, differences use Newcombe's hybrid of two Wilsons, and
 * means use Welch's t with a real t-quantile rather than 1.96.
 *
 * Effect sizes with intervals are the headline; there are deliberately no
 * p-values. "B raised agreement by 32 points [8 to 52]" says what happened
 * and how sure to be about it. "p = 0.03" invites the reader to stop there.
 *
 * Every function is total: empty or degenerate input returns a defined value
 * (or null where no value is meaningful), never NaN.
 */

export type Interval = { lo: number; hi: number };

/** Two-sided 95% normal quantile. */
export const Z95 = 1.959963984540054;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Wilson score interval for k successes in n trials. n = 0 is total ignorance: [0, 1]. */
export function wilson(k: number, n: number, z = Z95): Interval & { p: number } {
  if (n <= 0) return { p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  // At k = 0 and k = n the bound is exactly 0 or 1; pin it so float error
  // doesn't print as "99.99999%".
  return {
    p,
    lo: k <= 0 ? 0 : clamp01(center - half),
    hi: k >= n ? 1 : clamp01(center + half),
  };
}

/**
 * Difference in proportions p2 − p1 with Newcombe's hybrid score interval
 * (method 10, 1998): two Wilson intervals combined. Arguments are ordered
 * baseline first, so a positive diff means the second condition went up.
 */
export function newcombeDiff(
  k1: number,
  n1: number,
  k2: number,
  n2: number,
  z = Z95,
): Interval & { diff: number } {
  const a = wilson(k1, n1, z);
  const b = wilson(k2, n2, z);
  const diff = b.p - a.p;
  return {
    diff,
    lo: diff - Math.sqrt((b.p - b.lo) ** 2 + (a.hi - a.p) ** 2),
    hi: diff + Math.sqrt((b.hi - b.p) ** 2 + (a.p - a.lo) ** 2),
  };
}

/** Cohen's h for two proportions, signed as p2 relative to p1. */
export function cohenH(p1: number, p2: number): number {
  return 2 * Math.asin(Math.sqrt(clamp01(p2))) - 2 * Math.asin(Math.sqrt(clamp01(p1)));
}

export type EffectLabel = "negligible" | "small" | "medium" | "large";

/** Cohen's conventional thresholds (0.2 / 0.5 / 0.8), for h or g. */
export function effectLabel(effect: number): EffectLabel {
  const e = Math.abs(effect);
  if (e < 0.2) return "negligible";
  if (e < 0.5) return "small";
  if (e < 0.8) return "medium";
  return "large";
}

/** Mean and sample standard deviation (n − 1). sd is 0 below two values. */
export function meanSd(xs: number[]): { mean: number; sd: number; n: number } {
  const n = xs.length;
  if (n === 0) return { mean: 0, sd: 0, n };
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  if (n < 2) return { mean, sd: 0, n };
  const ss = xs.reduce((s, x) => s + (x - mean) ** 2, 0);
  return { mean, sd: Math.sqrt(ss / (n - 1)), n };
}

/** Two-sided 95% t critical values, df 1–30. */
const T975 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201,
  2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069,
  2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];
const T975_TAIL: [number, number][] = [
  [30, 2.042],
  [40, 2.021],
  [60, 2.0],
  [120, 1.98],
];

/**
 * The 97.5th percentile of Student's t. Welch's df is fractional, so values
 * between table rows are interpolated; beyond 120 it is the normal value.
 */
export function tQuantile975(df: number): number {
  if (!(df > 1)) return T975[0];
  if (df <= 30) {
    const lo = Math.floor(df);
    const frac = df - lo;
    const a = T975[lo - 1];
    const b = T975[Math.min(lo, 29)];
    return a + (b - a) * frac;
  }
  for (let i = 0; i < T975_TAIL.length - 1; i++) {
    const [d0, t0] = T975_TAIL[i];
    const [d1, t1] = T975_TAIL[i + 1];
    if (df <= d1) return t0 + ((t1 - t0) * (df - d0)) / (d1 - d0);
  }
  return Z95;
}

/**
 * Difference in means (b − a) with a Welch–Satterthwaite 95% interval.
 * Null when either side has fewer than two values — there is no variance to
 * speak of, and pretending otherwise is how a single run becomes a finding.
 */
export function welchDiff(a: number[], b: number[]): (Interval & { diff: number; df: number }) | null {
  if (a.length < 2 || b.length < 2) return null;
  const A = meanSd(a);
  const B = meanSd(b);
  const diff = B.mean - A.mean;
  const va = (A.sd * A.sd) / A.n;
  const vb = (B.sd * B.sd) / B.n;
  const se = Math.sqrt(va + vb);
  if (se === 0) return { diff, lo: diff, hi: diff, df: A.n + B.n - 2 };
  const df = (va + vb) ** 2 / (va ** 2 / (A.n - 1) + vb ** 2 / (B.n - 1));
  const t = tQuantile975(df);
  return { diff, lo: diff - t * se, hi: diff + t * se, df };
}

/**
 * Hedges' g: Cohen's d with the small-sample bias correction, signed as b
 * relative to a. Null when it is undefined (too few values, or no spread
 * at all with different means).
 */
export function hedgesG(a: number[], b: number[]): number | null {
  if (a.length < 2 || b.length < 2) return null;
  const A = meanSd(a);
  const B = meanSd(b);
  const pooled = Math.sqrt(
    ((A.n - 1) * A.sd ** 2 + (B.n - 1) * B.sd ** 2) / (A.n + B.n - 2),
  );
  if (pooled === 0) return B.mean === A.mean ? 0 : null;
  const d = (B.mean - A.mean) / pooled;
  return d * (1 - 3 / (4 * (A.n + B.n) - 9));
}

/**
 * Run-to-run variance for text: one minus the mean pairwise Jaccard
 * similarity of token sets. 0 means every run used the same words; values
 * near 1 mean the runs barely overlap. Tokenized exactly as Spread's
 * typicality ranking is, so the two agree. Null below two texts.
 */
export function meanPairwiseDistance(texts: string[]): number | null {
  if (texts.length < 2) return null;
  const sets = texts.map(tokenSet);
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      sum += jaccard(sets[i], sets[j]);
      pairs += 1;
    }
  }
  return 1 - sum / pairs;
}
