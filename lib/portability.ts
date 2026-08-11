import { PROVIDERS, type ProviderId } from "./providers";
import {
  assertionIsComplete,
  checkAssertion,
  type Assertion,
} from "./spread";

/**
 * Portability runs one spec across several models and asks whether it's a
 * *specification* or an *incantation*.
 *
 * Spread pivots one model against many samples. Portability pivots many models
 * against one spec, and reuses Spread's assertions deliberately: a designer
 * should learn the idea of a checkable clause once, then see it turned in a
 * different direction.
 *
 * The classification below is the whole payload. A clause that holds
 * everywhere is a real rule. A clause that holds on one vendor is a workaround
 * you've mistaken for a rule, and it will break silently the day someone
 * switches models. A clause that holds nowhere isn't a model problem at all —
 * it's an instruction that never did anything.
 */

export type ModelRef = {
  id: string;
  provider: ProviderId;
  model: string;
};

export type LaneRun = {
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

/** All runs for one model in the roster. */
export type LaneResult = {
  refId: string;
  runs: LaneRun[];
};

export const MIN_MODELS = 2;
export const MAX_MODELS = 4;
export const RUNS_PER_MODEL = [1, 3] as const;

/**
 * Three runs per model by default. One would be cheaper, but it would also
 * quietly contradict the lesson in Module 08: at a single sample per model, a
 * clause that's a coin flip *within* one model is indistinguishable from a
 * clause that's genuinely model-specific. Three isn't statistics, it's just
 * enough to tell those two apart.
 */
export const DEFAULT_RUNS_PER_MODEL = 3;

/** The in-browser engine is serial, so a full matrix on it is punishing. */
export const WEBLLM_RUNS_PER_MODEL = 1;

export function modelLabel(ref: ModelRef): string {
  const provider = PROVIDERS[ref.provider];
  return provider.models.find((m) => m.id === ref.model)?.name ?? ref.model;
}

export function newRefId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `ref_${crypto.randomUUID()}`;
  }
  return `ref_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// --- Scoring ---------------------------------------------------------------

export type Cell = {
  refId: string;
  hits: number;
  total: number;
  /** hits / total, or null when the model produced no usable runs. */
  rate: number | null;
};

export type Portability =
  | "portable"
  | "model-specific"
  | "unstable"
  | "absent"
  | "unknown";

export const PORTABILITY_LABEL: Record<Portability, string> = {
  portable: "Portable",
  "model-specific": "Model-specific",
  unstable: "Unstable",
  absent: "Not landing",
  unknown: "No data",
};

export const PORTABILITY_BLURB: Record<Portability, string> = {
  portable: "Held on every run on every model. This one is a real rule.",
  "model-specific":
    "Holds on some models and not others. You've tuned to a vendor — switching models breaks this silently.",
  unstable:
    "Roughly as unreliable on every model. Not a portability problem; run it in Spread and rewrite the clause.",
  absent:
    "Never held anywhere. Not a model problem — the instruction isn't doing anything.",
  unknown: "Not enough completed runs to say.",
};

/**
 * A gap this wide between the best and worst model is what separates "this
 * vendor behaves differently" from "this clause is shaky everywhere."
 */
const MODEL_GAP_THRESHOLD = 0.5;

export type ClauseRow = {
  assertion: Assertion;
  cells: Cell[];
  verdict: Portability;
};

function scoreCell(assertion: Assertion, lane: LaneResult): Cell {
  const done = lane.runs.filter((r) => r.status === "done");
  const hits = done.filter((r) => checkAssertion(assertion, r.text)).length;
  return {
    refId: lane.refId,
    hits,
    total: done.length,
    rate: done.length === 0 ? null : hits / done.length,
  };
}

export function classify(cells: Cell[]): Portability {
  const rates = cells
    .map((c) => c.rate)
    .filter((r): r is number => r !== null);
  if (rates.length === 0) return "unknown";
  const max = Math.max(...rates);
  const min = Math.min(...rates);
  if (min === 1) return "portable";
  if (max === 0) return "absent";
  if (max - min >= MODEL_GAP_THRESHOLD) return "model-specific";
  return "unstable";
}

export type PortabilityReport = {
  rows: ClauseRow[];
  portable: number;
  total: number;
  /** Models that produced at least one completed run. */
  modelsScored: number;
  /**
   * True when every model ran exactly once. At one sample per model the
   * "unstable" verdict is unreachable, so unstable clauses get misfiled as
   * model-specific — the UI has to say so rather than let the label stand.
   */
  singleSample: boolean;
};

export function buildPortabilityReport(
  assertions: Assertion[],
  lanes: LaneResult[],
): PortabilityReport {
  const complete = assertions.filter(assertionIsComplete);
  const rows = complete.map((assertion) => {
    const cells = lanes.map((lane) => scoreCell(assertion, lane));
    return { assertion, cells, verdict: classify(cells) };
  });
  const scored = lanes.filter((l) =>
    l.runs.some((r) => r.status === "done"),
  );
  return {
    rows,
    portable: rows.filter((r) => r.verdict === "portable").length,
    total: rows.length,
    modelsScored: scored.length,
    singleSample:
      scored.length > 0 &&
      scored.every(
        (l) => l.runs.filter((r) => r.status === "done").length === 1,
      ),
  };
}

/** Cost across the whole matrix — models × runs, not a single call. */
export function estimateMatrixCost(
  refs: ModelRef[],
  runsPerModel: number,
  system: string,
  userMessage: string,
): number {
  const inputTokens = Math.ceil((system.length + userMessage.length) / 4);
  const assumedOutput = 250;
  return refs.reduce((sum, ref) => {
    const meta = PROVIDERS[ref.provider].models.find((m) => m.id === ref.model);
    if (!meta) return sum;
    const perRun =
      (inputTokens / 1_000_000) * meta.inputPer1M +
      (assumedOutput / 1_000_000) * meta.outputPer1M;
    return sum + perRun * runsPerModel;
  }, 0);
}

// --- Seeds -----------------------------------------------------------------

export const SEED_SYSTEM = `You are a support assistant for a photo-storage app.
Answer in exactly two sentences.
Never apologise.
Always end by pointing to the Help Centre.`;

export const SEED_MESSAGE =
  "I can't find the photos I uploaded last night. Where did they go?";

/**
 * Three clauses of deliberately different character, so the first matrix has a
 * chance of splitting rather than coming back uniformly green: a prohibition,
 * a required mention, and a length cap. Prohibitions are the usual suspects
 * for vendor-specific behaviour and length caps the usual suspects for
 * drifting, but which one actually breaks is the thing to discover here — the
 * seed is chosen to make the question interesting, not to guarantee an answer.
 */
export const SEED_ASSERTIONS: Assertion[] = [
  { id: "seed_sorry", kind: "excludes", value: "sorry" },
  { id: "seed_help", kind: "contains", value: "Help Centre" },
  { id: "seed_len", kind: "maxWords", value: "60" },
];
