import { ProviderId, getModel } from "./providers";

/**
 * Spread runs one configuration N times and scores the variance. The teaching
 * payload is the Stability Report: the user writes checkable claims about
 * their own spec, and each one comes back as a hit rate over the N runs.
 *
 * Every assertion here is evaluated locally, with zero extra API calls. That
 * is a deliberate boundary, not a shortcut — LLM-as-judge (and the discovery
 * that the judge is biased) is the payload of a later module, and putting a
 * judge here would both spend that lesson early and make each run cost N+1
 * calls instead of N.
 *
 * The tradeoff, which the UI states plainly: these catch *mechanical* drift
 * (length, forbidden words, required mentions), not *tonal* drift. Tonal
 * spread is what the outlier ranking and the pairwise diff are for.
 */

export type AssertionKind = "contains" | "excludes" | "maxWords" | "minWords";

export type Assertion = {
  id: string;
  kind: AssertionKind;
  /** Phrase for contains/excludes; a number as text for the word-count kinds. */
  value: string;
};

export type SpreadRun = {
  id: string;
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  startMs?: number;
  endMs?: number;
  /**
   * Jaccard distance from the medoid run, 0–1. Assigned by `rankRuns` once
   * every run has settled; undefined before that.
   *
   * Zero does not imply "is the medoid" — typicality is measured on
   * normalized token sets, so two runs differing only in punctuation or case
   * (exactly the kind of drift an assertion catches) both sit at distance 0.
   */
  distance?: number;
  /** Set by `rankRuns` on exactly one run — the medoid itself. */
  isMedoid?: boolean;
};

export const ASSERTION_KIND_LABELS: Record<AssertionKind, string> = {
  contains: "Contains",
  excludes: "Excludes",
  maxWords: "At most (words)",
  minWords: "At least (words)",
};

export const RUN_COUNTS = [3, 5, 10] as const;

/**
 * The in-browser engine holds a single GPU context, so its runs execute
 * sequentially rather than in parallel. Ten sequential runs on the default
 * 1B model is slow enough to read as broken — and WebLLM is the *default*
 * provider, so the free path hits the worst case first. Cap it lower.
 */
export const WEBLLM_MAX_RUNS = 5;
export const WEBLLM_DEFAULT_RUNS = 3;
export const DEFAULT_RUNS = 5;

/** Firing 10 requests at once trips per-minute limits on entry-tier keys. */
export const BYOK_CONCURRENCY = 4;
export const WEBLLM_CONCURRENCY = 1;

export function maxRunsFor(provider: ProviderId): number {
  return provider === "webllm" ? WEBLLM_MAX_RUNS : 10;
}

export function concurrencyFor(provider: ProviderId): number {
  return provider === "webllm" ? WEBLLM_CONCURRENCY : BYOK_CONCURRENCY;
}

export function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * An assertion with a blank or unparseable value is still being written —
 * it's excluded from scoring rather than counted as a failure.
 */
export function assertionIsComplete(a: Assertion): boolean {
  const v = a.value.trim();
  if (!v) return false;
  if (a.kind === "maxWords" || a.kind === "minWords") {
    const n = Number(v);
    return Number.isFinite(n) && n > 0;
  }
  return true;
}

/** Human phrasing for the Stability Report row. */
export function assertionLabel(a: Assertion): string {
  const v = a.value.trim();
  switch (a.kind) {
    case "contains":
      return v ? `Contains “${v}”` : "Contains …";
    case "excludes":
      return v ? `Excludes “${v}”` : "Excludes …";
    case "maxWords":
      return v ? `At most ${v} words` : "At most … words";
    case "minWords":
      return v ? `At least ${v} words` : "At least … words";
  }
}

/** Whether one output satisfies one assertion. */
export function checkAssertion(a: Assertion, text: string): boolean {
  const v = a.value.trim();
  switch (a.kind) {
    case "contains":
      return text.toLowerCase().includes(v.toLowerCase());
    case "excludes":
      return !text.toLowerCase().includes(v.toLowerCase());
    case "maxWords":
      return wordCount(text) <= Number(v);
    case "minWords":
      return wordCount(text) >= Number(v);
  }
}

export type AssertionResult = {
  assertion: Assertion;
  hits: number;
  total: number;
  /** True when the assertion held on every completed run. */
  held: boolean;
  /** Ids of the runs that failed this assertion, for highlighting. */
  failedRunIds: string[];
};

export function scoreAssertion(
  assertion: Assertion,
  runs: SpreadRun[],
): AssertionResult {
  const scored = runs.filter((r) => r.status === "done");
  const failedRunIds: string[] = [];
  let hits = 0;
  for (const run of scored) {
    if (checkAssertion(assertion, run.text)) {
      hits += 1;
    } else {
      failedRunIds.push(run.id);
    }
  }
  return {
    assertion,
    hits,
    total: scored.length,
    held: scored.length > 0 && hits === scored.length,
    failedRunIds,
  };
}

export type StabilityReport = {
  results: AssertionResult[];
  /** Assertions that held on every run. */
  held: number;
  /** Complete assertions that were scorable at all. */
  total: number;
  /** Completed runs the report is based on. */
  runCount: number;
};

export function buildReport(
  assertions: Assertion[],
  runs: SpreadRun[],
): StabilityReport {
  const complete = assertions.filter(assertionIsComplete);
  const results = complete.map((a) => scoreAssertion(a, runs));
  return {
    results,
    held: results.filter((r) => r.held).length,
    total: results.length,
    runCount: runs.filter((r) => r.status === "done").length,
  };
}

// --- Typicality ------------------------------------------------------------
// Ranking every pair with the word-level LCS in lib/diff-words.ts would be
// O(n·m) per pair; at 10 runs of ~300 tokens that's millions of DP cells on
// the main thread. So ranking uses a cheap token-set Jaccard over all pairs,
// and the expensive LCS is reserved for the single pair the user opens.

function tokenSet(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  return new Set(words);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let shared = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) if (large.has(t)) shared += 1;
  const union = a.size + b.size - shared;
  return union === 0 ? 1 : shared / union;
}

/**
 * Order runs most-typical → most-outlier and stamp each with its distance
 * from the medoid (the run most similar to all the others). Runs that errored
 * sort last and carry no distance. Non-mutating.
 */
export function rankRuns(runs: SpreadRun[]): SpreadRun[] {
  const done = runs.filter((r) => r.status === "done");
  const rest = runs.filter((r) => r.status !== "done");
  if (done.length < 2) {
    return [...done.map((r) => ({ ...r, isMedoid: false })), ...rest];
  }

  const sets = done.map((r) => tokenSet(r.text));
  const sims: number[][] = done.map(() => new Array(done.length).fill(0));
  for (let i = 0; i < done.length; i++) {
    for (let j = i + 1; j < done.length; j++) {
      const s = jaccard(sets[i], sets[j]);
      sims[i][j] = s;
      sims[j][i] = s;
    }
  }

  let medoid = 0;
  let best = -1;
  for (let i = 0; i < done.length; i++) {
    let sum = 0;
    for (let j = 0; j < done.length; j++) if (i !== j) sum += sims[i][j];
    const avg = sum / (done.length - 1);
    if (avg > best) {
      best = avg;
      medoid = i;
    }
  }

  const ranked = done.map((run, i) => ({
    ...run,
    distance: i === medoid ? 0 : 1 - sims[i][medoid],
    // Exactly one run carries this. Ties at distance 0 are common (identical
    // wording, or wording that differs only in punctuation), so the flag has
    // to be explicit rather than inferred from the distance.
    isMedoid: i === medoid,
  }));
  ranked.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return [...ranked, ...rest];
}

// --- Cost ------------------------------------------------------------------

/**
 * Output length is unknowable before the call, so the preview assumes a
 * short-completion budget. It exists to stop someone firing 10 frontier-model
 * runs without warning, not to be an invoice — the UI marks it as an estimate.
 */
const ASSUMED_OUTPUT_TOKENS = 250;

export function estimateRunCost(
  provider: ProviderId,
  model: string,
  system: string,
  userMessage: string,
  runCount: number,
): number {
  const meta = getModel(provider, model);
  if (!meta) return 0;
  const inputTokens = Math.ceil((system.length + userMessage.length) / 4);
  const perRun =
    (inputTokens / 1_000_000) * meta.inputPer1M +
    (ASSUMED_OUTPUT_TOKENS / 1_000_000) * meta.outputPer1M;
  return perRun * runCount;
}

// --- Concurrency -----------------------------------------------------------

/**
 * Run `worker` over every item with at most `limit` in flight. Used to keep
 * BYOK runs inside per-minute rate limits, and to force the in-browser engine
 * (limit 1) to execute strictly one at a time.
 */
export async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const size = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: size }, () => lane()));
}

// --- Seeds -----------------------------------------------------------------

export const SEED_SYSTEM =
  "You are a UX writer for a user research tool. Write warm, plain microcopy. No exclamation marks.";

export const SEED_MESSAGE =
  "Write a one-sentence welcome message for a research interview tool.";

/**
 * Seeded so the first run demonstrates the lesson rather than a clean sweep.
 * The word cap and the "interview" mention usually hold; the exclamation-mark
 * ban usually does not, even though the system prompt asks for it directly —
 * which is the whole point.
 */
export const SEED_ASSERTIONS: Assertion[] = [
  { id: "seed_words", kind: "maxWords", value: "25" },
  { id: "seed_bang", kind: "excludes", value: "!" },
  { id: "seed_topic", kind: "contains", value: "interview" },
];
