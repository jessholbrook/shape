import { isBinary, type Experiment } from "./experiment";
import { answersForRates, detectableRateChange, detectableShift } from "./stats";

/**
 * What an experiment's runs can and can't detect, before running it.
 *
 * Each version (condition) is compared with the baseline, pooling every
 * item, so the sample that matters is runs-per-cell × items. The lab caps
 * that at a few dozen — enough to catch large effects only. Pooling a class
 * multiplies it, which is often the only way to see a modest change; the
 * plan says so.
 *
 * Yes/no measures assume a 50% starting rate: the hardest case, so the
 * numbers are honest whatever the real rate turns out to be.
 */

export type Plan = {
  /** Answers each version gets per run of the experiment (one student's worth in a class). */
  perVersion: number;
  items: number;
  hasRates: boolean;
  hasNumeric: boolean;
  /** Smallest yes/no change these answers reliably catch, in points; null if not even 50. */
  detectablePoints: number | null;
  /** Smallest numeric shift these answers reliably catch, in standard deviations (Cohen's d). */
  detectableD: number | null;
};

export function planFor(e: Pick<Experiment, "items" | "measures">, n: number): Plan {
  const items = Math.max(1, e.items.length);
  const perVersion = Math.max(0, Math.floor(n)) * items;
  return {
    perVersion,
    items,
    hasRates: e.measures.some(isBinary),
    hasNumeric: e.measures.some((m) => !isBinary(m)),
    detectablePoints: detectableRateChange(perVersion),
    detectableD: detectableShift(perVersion),
  };
}

export type Target = {
  points: number;
  /** Answers per version needed. */
  needed: number;
  /** Runs per cell that gives, at this many items. */
  runsPerCell: number;
  /** Whether one run of the experiment can get there under the lab's cap. */
  fits: boolean;
  /** Runs of the experiment (students, in a class) needed at the current runs per cell. */
  runsNeeded: number;
};

/** What it takes to reliably catch a change of `points` in a yes/no measure. */
export function target(plan: Plan, points: number, maxRunsPerCell: number): Target | null {
  const needed = answersForRates(0.5, 0.5 + points / 100);
  if (needed === null || plan.perVersion < 1) return null;
  const runsPerCell = Math.ceil(needed / plan.items);
  return {
    points,
    needed,
    runsPerCell,
    fits: runsPerCell <= maxRunsPerCell,
    runsNeeded: Math.ceil(needed / plan.perVersion),
  };
}

/** The change sizes offered as targets, in points. */
export const TARGET_POINTS = [10, 15, 20, 30] as const;
