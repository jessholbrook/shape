import { PROVIDERS, type ProviderId } from "./providers";

/**
 * Race runs one prompt through two models at once and measures what the other
 * playgrounds ignore: time and money.
 *
 * Diff Mode already puts two configs side by side, but its axis is the
 * *prompt* and its question is "what changed in the text." Race's axis is the
 * *model*, and its question is "what did that quality cost you." The numbers
 * it surfaces — time to first token, throughput, cost ratio — are the ones a
 * user actually feels and a budget actually pays.
 *
 * The lesson only lands if the speed facts arrive *before* the quality
 * judgment, which is why the verdict line ends by asking which one you'd ship.
 */

export type LaneId = "a" | "b";

export type RaceResult = {
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  /** When this lane's own request started — not when the Run button was hit. */
  startMs?: number;
  /** When the first text delta landed. */
  firstTokenMs?: number;
  endMs?: number;
};

export const EMPTY_RACE_RESULT: RaceResult = { text: "", status: "idle" };

/**
 * Time to first token — the number a user actually experiences as "slow."
 * Total time is dominated by how much the model chose to write, which is a
 * different property entirely.
 */
export function ttftMs(r: RaceResult): number | null {
  if (r.startMs == null || r.firstTokenMs == null) return null;
  return r.firstTokenMs - r.startMs;
}

export function totalMs(r: RaceResult): number | null {
  if (r.startMs == null || r.endMs == null) return null;
  return r.endMs - r.startMs;
}

/**
 * Throughput across the generation phase only — first token to last. Including
 * the wait before the first token would blend two unrelated things (queueing
 * and decoding) into one misleading number.
 *
 * Returns null rather than Infinity when a response arrives in a single chunk
 * and there is no measurable generation window.
 */
export function tokensPerSecond(r: RaceResult): number | null {
  if (r.firstTokenMs == null || r.endMs == null) return null;
  if (r.outputTokens == null || r.outputTokens <= 0) return null;
  const seconds = (r.endMs - r.firstTokenMs) / 1000;
  if (seconds <= 0) return null;
  return r.outputTokens / seconds;
}

export type Comparison = {
  /** Lane that won this measure, or null when they're effectively tied. */
  winner: LaneId | null;
  /** How many times better the winner was. 1 when tied. */
  factor: number;
};

/** Lower-is-better comparison (times, costs). */
function compareLower(a: number | null, b: number | null): Comparison | null {
  if (a == null || b == null) return null;
  if (a <= 0 || b <= 0) return null;
  if (a === b) return { winner: null, factor: 1 };
  return a < b
    ? { winner: "a", factor: b / a }
    : { winner: "b", factor: a / b };
}

export type RaceVerdict = {
  speed: Comparison | null;
  firstToken: Comparison | null;
  cost: Comparison | null;
  /** True when both lanes finished cleanly and a comparison is meaningful. */
  complete: boolean;
};

export function buildVerdict(a: RaceResult, b: RaceResult): RaceVerdict {
  const complete = a.status === "done" && b.status === "done";
  if (!complete) {
    return { speed: null, firstToken: null, cost: null, complete: false };
  }
  return {
    speed: compareLower(totalMs(a), totalMs(b)),
    firstToken: compareLower(ttftMs(a), ttftMs(b)),
    // Free providers cost 0, which makes a ratio meaningless rather than
    // infinite — compareLower returns null and the UI says "free" instead.
    cost: compareLower(a.costUsd ?? null, b.costUsd ?? null),
    complete: true,
  };
}

/**
 * "3×" / "3.2×" / "13×" — one decimal below 10, none above, and no trailing
 * ".0". This is the headline number, so a bare "3×" reads better than "3.0×".
 */
export function formatFactor(factor: number): string {
  if (factor >= 10) return `${Math.round(factor)}×`;
  return `${factor.toFixed(1).replace(/\.0$/, "")}×`;
}

export function formatMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd === 0) return "free";
  if (usd < 0.001) return "<$0.001";
  return `$${usd.toFixed(4)}`;
}

/**
 * Both lanes on the in-browser engine can't actually race — it holds a single
 * GPU context and serializes them. Per-lane numbers stay honest (each lane
 * times its own request), but the side-by-side visual isn't a real contest,
 * so the UI has to say so.
 */
export function lanesContendForGpu(a: ProviderId, b: ProviderId): boolean {
  return a === "webllm" && b === "webllm";
}

/**
 * Pick the fastest-tier model a provider offers, for seeding lane B against
 * lane A's default. Frontier-vs-fast on the same provider is the sharpest
 * version of the tradeoff: same vendor, same prompt, very different bill.
 */
export function fastestModelFor(providerId: ProviderId): string {
  const provider = PROVIDERS[providerId];
  const fast = provider.models.find((m) => m.tier === "fast");
  return (fast ?? provider.models[provider.models.length - 1]).id;
}

export const SEED_SYSTEM =
  "You are a helpful product writer. Answer directly and concretely.";

export const SEED_MESSAGE =
  "Explain what a design system is to a new engineer, in about a paragraph.";

/**
 * The zero-key default: two in-browser models of very different size. It's a
 * genuine speed difference and it works with no key at all — the GPU
 * contention warning covers the fact that they take turns.
 */
export const SEED_WEBLLM_A = "Llama-3.2-3B-Instruct-q4f16_1-MLC";
export const SEED_WEBLLM_B = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
