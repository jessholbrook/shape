import type { ProviderId } from "./providers";
import type { ChatCall } from "./providers/types";
import type { LensId } from "./lenses";
import { checkAssertion, wordCount, type Assertion } from "./spread";
import {
  cohenH,
  effectLabel,
  hedgesG,
  meanPairwiseDistance,
  meanSd,
  newcombeDiff,
  welchDiff,
  wilson,
  type Interval,
} from "./stats";

/**
 * An experiment: a question asked of model behavior, answered with enough
 * runs and enough bookkeeping that someone else could check the answer.
 *
 * Shape: a base configuration, one or more conditions that each patch it
 * (condition 0 is the baseline), an optional set of items that fill
 * {{variables}} in the user message, N runs per condition × item, and
 * measures that score every run. `analyze` turns the runs into per-condition
 * stats and baseline comparisons; `buildManifest` records exactly what was
 * run, so a shared result can be rerun.
 *
 * Pure: no network, no storage, no React. Running the calls is the UI's job.
 */

export type LabModel = { provider: ProviderId; model: string };

export type Condition = {
  id: string;
  label: string;
  /** Overrides on the base config. Anything left out inherits. */
  patch: {
    system?: string;
    userTemplate?: string;
    temperature?: number;
    model?: LabModel;
  };
};

export type Item = {
  id: string;
  label: string;
  /** Fills {{name}} placeholders in the user template. */
  vars: Record<string, string>;
};

export type Measure =
  | { id: string; label: string; kind: "assertion"; assertion: Assertion }
  | { id: string; label: string; kind: "regex"; pattern: string; flags?: string }
  | { id: string; label: string; kind: "length" }
  | {
      id: string;
      label: string;
      kind: "classify";
      /** What the judge is asked about the output. */
      question: string;
      labels: string[];
      /** The label counted as a hit. */
      target: string;
      judge: LabModel;
    }
  | { id: string; label: string; kind: "rate"; rubric: string; scale: 5 | 7; judge: LabModel };

export type MeasureKind = Measure["kind"];

const BINARY_KINDS: readonly MeasureKind[] = ["assertion", "regex", "classify"];
const NUMERIC_KINDS: readonly MeasureKind[] = ["length", "rate"];
const JUDGE_KINDS: readonly MeasureKind[] = ["classify", "rate"];

export const isBinary = (m: Measure) => BINARY_KINDS.includes(m.kind);
export const usesJudge = (m: Measure) => JUDGE_KINDS.includes(m.kind);

export type RunStatus = "idle" | "running" | "done" | "error";

export type ExperimentRun = {
  id: string;
  conditionId: string;
  /** Null when the experiment has no items. */
  itemId: string | null;
  /** 0-based repeat index within the cell. */
  index: number;
  status: RunStatus;
  text: string;
  error?: string;
  requestedModel: string;
  /** The model the provider reports having served, when it says. */
  resolvedModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  startedAt?: number;
  /** measureId → score. Null means unscored or unparseable — never a zero. */
  scores: Record<string, boolean | number | null>;
};

export type BaseConfig = {
  system: string;
  userTemplate: string;
  temperature: number;
  maxTokens: number;
  model: LabModel;
};

export type Experiment = {
  id: string;
  title: string;
  lens?: LensId;
  question: string;
  hypothesis: string;
  /** Set on first run; the hypothesis is fixed from then on. */
  hypothesisLockedAt?: number;
  base: BaseConfig;
  conditions: Condition[];
  items: Item[];
  /** Runs per condition × item. */
  n: number;
  measures: Measure[];
  runs: ExperimentRun[];
  forkedFrom?: { slug: string; manifestHash: string };
  createdAt: number;
  updatedAt: number;
};

export const MAX_N = 50;

// --- Design --------------------------------------------------------------------

/**
 * Fill {{name}} placeholders. An unknown name is left visible as-is: a
 * silently blank variable produces a plausible-looking prompt that tests the
 * wrong thing.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : whole,
  );
}

export type Cell = { conditionId: string; itemId: string | null };

/** Every condition × item, conditions outermost, in declaration order. */
export function expandCells(e: Pick<Experiment, "conditions" | "items">): Cell[] {
  const items: (string | null)[] = e.items.length ? e.items.map((i) => i.id) : [null];
  return e.conditions.flatMap((c) => items.map((itemId) => ({ conditionId: c.id, itemId })));
}

/** Model calls a full run will make: every run, plus one per judge measure per run. */
export function plannedCalls(e: Pick<Experiment, "conditions" | "items" | "n" | "measures">): number {
  const runs = expandCells(e).length * e.n;
  const judges = e.measures.filter(usesJudge).length;
  return runs * (1 + judges);
}

/** The exact call for one cell, minus the API key — which never enters an experiment. */
export type ResolvedCall = Omit<ChatCall, "apiKey" | "tools"> & { maxTokens: number };

export function resolveCall(e: Experiment, conditionId: string, itemId: string | null): ResolvedCall {
  const condition = e.conditions.find((c) => c.id === conditionId);
  if (!condition) throw new Error(`Unknown condition "${conditionId}"`);
  const item = itemId === null ? undefined : e.items.find((i) => i.id === itemId);
  if (itemId !== null && !item) throw new Error(`Unknown item "${itemId}"`);
  const p = condition.patch;
  const model = p.model ?? e.base.model;
  return {
    provider: model.provider,
    model: model.model,
    system: p.system ?? e.base.system,
    messages: [{ role: "user", content: fillTemplate(p.userTemplate ?? e.base.userTemplate, item?.vars ?? {}) }],
    temperature: p.temperature ?? e.base.temperature,
    maxTokens: e.base.maxTokens,
  };
}

// --- Scoring -------------------------------------------------------------------

/**
 * Score a local measure (no model call). Judge measures return null here —
 * they are scored by parsing the judge's reply. An invalid regex scores null
 * rather than throwing: a typo in a pattern should cost one measure, not
 * the whole report.
 */
export function scoreLocal(m: Measure, text: string): boolean | number | null {
  switch (m.kind) {
    case "assertion":
      return checkAssertion(m.assertion, text);
    case "regex":
      try {
        return new RegExp(m.pattern, m.flags).test(text);
      } catch {
        return null;
      }
    case "length":
      return wordCount(text);
    default:
      return null;
  }
}

export function composeClassifier(
  m: Extract<Measure, { kind: "classify" }>,
  text: string,
): { system: string; user: string } {
  return {
    system: `You are a careful annotator. Read the response and answer the question about it. Reason briefly if you need to, then end with a final line of the form:
LABEL: <one of ${m.labels.map((l) => `"${l}"`).join(", ")}>`,
    user: `Question: ${m.question}\n\n<response>\n${text}\n</response>`,
  };
}

/**
 * Which label the judge chose. The last "LABEL:" line wins — judges reason
 * through options before concluding. Without one, a reply that names
 * exactly one label counts; anything ambiguous is null, not a guess.
 */
export function parseClassifier(raw: string, labels: string[]): string | null {
  const find = (s: string) => labels.find((l) => l.toLowerCase() === s.trim().toLowerCase().replace(/^["'*]+|["'.*]+$/g, ""));
  const tagged = [...raw.matchAll(/LABEL\s*:\s*(.+)/gi)];
  for (let i = tagged.length - 1; i >= 0; i--) {
    const hit = find(tagged[i][1]);
    if (hit) return hit;
  }
  const lower = raw.toLowerCase();
  const named = labels.filter((l) => new RegExp(`\\b${escapeRegExp(l.toLowerCase())}\\b`).test(lower));
  return named.length === 1 ? named[0] : null;
}

export function composeRater(
  m: Extract<Measure, { kind: "rate" }>,
  text: string,
): { system: string; user: string } {
  return {
    system: `You are a careful rater. Rate the response against the rubric on a scale of 1 to ${m.scale}. Reason briefly if you need to, then end with a final line of the form:
RATING: <integer from 1 to ${m.scale}>`,
    user: `Rubric: ${m.rubric}\n\n<response>\n${text}\n</response>`,
  };
}

/** The last "RATING: n" within range, else null. */
export function parseRating(raw: string, scale: number): number | null {
  const matches = [...raw.matchAll(/RATING\s*:\s*(\d+)/gi)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const n = Number(matches[i][1]);
    if (Number.isInteger(n) && n >= 1 && n <= scale) return n;
  }
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Analysis ------------------------------------------------------------------

export type BinaryCellStat = {
  kind: "binary";
  conditionId: string;
  measureId: string;
  k: number;
  n: number;
  /** Runs in this condition that don't count: errored, unfinished, or unscored. */
  excluded: number;
  rate: Interval & { p: number };
};

export type NumericCellStat = {
  kind: "numeric";
  conditionId: string;
  measureId: string;
  n: number;
  excluded: number;
  mean: number;
  sd: number;
};

export type CellStat = BinaryCellStat | NumericCellStat;

export type Comparison =
  | {
      kind: "binary";
      measureId: string;
      baselineId: string;
      conditionId: string;
      /** Difference in hit rate, condition − baseline, with a Newcombe interval. */
      diff: Interval & { diff: number };
      /** Cohen's h. */
      effect: number;
      nBaseline: number;
      nCondition: number;
    }
  | {
      kind: "numeric";
      measureId: string;
      baselineId: string;
      conditionId: string;
      /** Difference in means with a Welch interval; null below two scored runs a side. */
      diff: (Interval & { diff: number; df: number }) | null;
      /** Hedges' g; null when undefined. */
      effect: number | null;
      nBaseline: number;
      nCondition: number;
    };

export type VarianceStat = { conditionId: string; distance: number | null; n: number };

export type Analysis = {
  cells: CellStat[];
  comparisons: Comparison[];
  /** Run-to-run text variance per condition (1 − mean pairwise Jaccard). */
  variance: VarianceStat[];
  /** More than three comparisons: some "clear" differences will be chance. */
  manyComparisons: boolean;
};

function scored(runs: ExperimentRun[], measureId: string): (boolean | number)[] {
  const out: (boolean | number)[] = [];
  for (const r of runs) {
    if (r.status !== "done") continue;
    const v = r.scores[measureId];
    if (v !== null && v !== undefined) out.push(v);
  }
  return out;
}

/**
 * Per-condition stats for every measure, pooled over items, and each
 * condition compared with the baseline (condition 0). Only finished runs with
 * a real score count; everything else is reported as excluded rather than
 * quietly dropped or scored as a miss.
 */
export function analyze(e: Experiment): Analysis {
  const byCondition = new Map<string, ExperimentRun[]>();
  for (const c of e.conditions) byCondition.set(c.id, []);
  for (const r of e.runs) byCondition.get(r.conditionId)?.push(r);

  const cells: CellStat[] = [];
  for (const m of e.measures) {
    for (const c of e.conditions) {
      const runs = byCondition.get(c.id) ?? [];
      const values = scored(runs, m.id);
      const excluded = runs.length - values.length;
      if (isBinary(m)) {
        const k = values.filter((v) => v === true).length;
        cells.push({
          kind: "binary",
          conditionId: c.id,
          measureId: m.id,
          k,
          n: values.length,
          excluded,
          rate: wilson(k, values.length),
        });
      } else {
        const nums = values.filter((v): v is number => typeof v === "number");
        const { mean, sd, n } = meanSd(nums);
        cells.push({ kind: "numeric", conditionId: c.id, measureId: m.id, n, excluded, mean, sd });
      }
    }
  }

  const comparisons: Comparison[] = [];
  const baseline = e.conditions[0];
  if (baseline) {
    for (const m of e.measures) {
      const baseRuns = byCondition.get(baseline.id) ?? [];
      for (const c of e.conditions.slice(1)) {
        const runs = byCondition.get(c.id) ?? [];
        if (isBinary(m)) {
          const a = scored(baseRuns, m.id);
          const b = scored(runs, m.id);
          const ka = a.filter((v) => v === true).length;
          const kb = b.filter((v) => v === true).length;
          comparisons.push({
            kind: "binary",
            measureId: m.id,
            baselineId: baseline.id,
            conditionId: c.id,
            diff: newcombeDiff(ka, a.length, kb, b.length),
            effect: cohenH(a.length ? ka / a.length : 0, b.length ? kb / b.length : 0),
            nBaseline: a.length,
            nCondition: b.length,
          });
        } else {
          const a = scored(baseRuns, m.id).filter((v): v is number => typeof v === "number");
          const b = scored(runs, m.id).filter((v): v is number => typeof v === "number");
          comparisons.push({
            kind: "numeric",
            measureId: m.id,
            baselineId: baseline.id,
            conditionId: c.id,
            diff: welchDiff(a, b),
            effect: hedgesG(a, b),
            nBaseline: a.length,
            nCondition: b.length,
          });
        }
      }
    }
  }

  const variance: VarianceStat[] = e.conditions.map((c) => {
    const texts = (byCondition.get(c.id) ?? []).filter((r) => r.status === "done").map((r) => r.text);
    return { conditionId: c.id, distance: meanPairwiseDistance(texts), n: texts.length };
  });

  return { cells, comparisons, variance, manyComparisons: comparisons.length > 3 };
}

/** True when the interval rules out no difference. */
export function isClear(c: Comparison): boolean {
  if (!c.diff) return false;
  return c.diff.lo > 0 || c.diff.hi < 0;
}

const pts = (x: number) => Math.round(x * 100);
const num = (x: number) => (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1));

/**
 * One plain-English sentence for a comparison. When the interval spans zero
 * it says so first — a point estimate that might be noise shouldn't be the
 * thing the reader remembers.
 */
export function summarize(e: Experiment, c: Comparison): string {
  const measure = e.measures.find((m) => m.id === c.measureId)?.label ?? c.measureId;
  const cond = e.conditions.find((x) => x.id === c.conditionId)?.label ?? c.conditionId;
  const base = e.conditions.find((x) => x.id === c.baselineId)?.label ?? c.baselineId;
  const ns = `n = ${c.nCondition} vs ${c.nBaseline}`;

  if (c.kind === "binary") {
    const d = c.diff;
    const range = `[${pts(d.lo)} to ${pts(d.hi)}]`;
    if (!isClear(c)) {
      return `No clear difference in “${measure}” between ${cond} and ${base}: ${signed(pts(d.diff))} points ${range}, ${ns}.`;
    }
    return `${cond} ${d.diff > 0 ? "raised" : "lowered"} “${measure}” by ${Math.abs(pts(d.diff))} points ${range} — a ${effectLabel(c.effect)} effect (h = ${c.effect.toFixed(2)}), ${ns}.`;
  }

  if (!c.diff) {
    return `Not enough scored runs to compare “${measure}” between ${cond} and ${base} (${ns}; at least 2 each).`;
  }
  const d = c.diff;
  const range = `[${num(d.lo)} to ${num(d.hi)}]`;
  if (!isClear(c)) {
    return `No clear difference in “${measure}” between ${cond} and ${base}: ${signed(Number(num(d.diff)))} ${range}, ${ns}.`;
  }
  const g = c.effect === null ? "" : ` — a ${effectLabel(c.effect)} effect (g = ${c.effect.toFixed(2)})`;
  return `${cond} ${d.diff > 0 ? "raised" : "lowered"} “${measure}” by ${num(Math.abs(d.diff))} ${range}${g}, ${ns}.`;
}

const signed = (x: number) => (x > 0 ? `+${x}` : `${x}`);

// --- Reproducibility -----------------------------------------------------------

export type Runner = "hosted" | "byok" | "webllm" | "custom";

export type Manifest = {
  schema: "shape.manifest.v1";
  appVersion: string;
  ranAt: string;
  runner: Runner;
  models: { requested: string[]; resolved: string[]; judges: string[] };
  params: { temperature: number[]; maxTokens: number; n: number };
  prompts: { conditionId: string; itemId: string | null; provider: ProviderId; model: string; system: string; user: string; temperature: number }[];
  judgePrompts: { measureId: string; kind: "classify" | "rate"; model: string; system: string }[];
  statsMethods: { proportion: "wilson"; difference: "newcombe-hybrid"; means: "welch"; effect: "cohen-h / hedges-g" };
  notes: string[];
};

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * Everything needed to rerun an experiment, and nothing secret: prompts come
 * from resolveCall, which never carries a key.
 */
export function buildManifest(
  e: Experiment,
  meta: { appVersion: string; ranAt: string; runner: Runner },
): Manifest {
  const prompts = expandCells(e).map(({ conditionId, itemId }) => {
    const call = resolveCall(e, conditionId, itemId);
    const first = call.messages[0];
    return {
      conditionId,
      itemId,
      provider: call.provider,
      model: call.model,
      system: call.system,
      user: first && first.role === "user" ? first.content : "",
      temperature: call.temperature,
    };
  });

  const judgePrompts = e.measures.flatMap((m): Manifest["judgePrompts"] => {
    if (m.kind === "classify") {
      return [{ measureId: m.id, kind: "classify", model: m.judge.model, system: composeClassifier(m, "").system }];
    }
    if (m.kind === "rate") {
      return [{ measureId: m.id, kind: "rate", model: m.judge.model, system: composeRater(m, "").system }];
    }
    return [];
  });

  return {
    schema: "shape.manifest.v1",
    appVersion: meta.appVersion,
    ranAt: meta.ranAt,
    runner: meta.runner,
    models: {
      requested: uniq(prompts.map((p) => p.model)),
      resolved: uniq(e.runs.map((r) => r.resolvedModel).filter((m): m is string => !!m)),
      judges: uniq(judgePrompts.map((j) => j.model)),
    },
    params: { temperature: uniq(prompts.map((p) => p.temperature)), maxTokens: e.base.maxTokens, n: e.n },
    prompts,
    judgePrompts,
    statsMethods: { proportion: "wilson", difference: "newcombe-hybrid", means: "welch", effect: "cohen-h / hedges-g" },
    notes: [
      "Sampling is non-deterministic: a rerun estimates the same distribution, not the same text.",
      "Hosted model versions can change behind a fixed name; compare models.resolved across runs.",
    ],
  };
}

/** JSON with object keys sorted at every level, so equal manifests hash equally. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v,
  );
}

/** SHA-256 hex of the canonical manifest. Works in browsers and Node 20+. */
export async function manifestHash(m: Manifest): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(m));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Validation ----------------------------------------------------------------

export type ValidationResult = { ok: true; experiment: Experiment } | { ok: false; reason: string };

const MEASURE_KINDS: readonly MeasureKind[] = [...BINARY_KINDS, ...NUMERIC_KINDS];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isModel = (v: unknown) => isObj(v) && isStr(v.provider) && isStr(v.model);

/** Shape check for imported or shared experiments. Says what's wrong, not just that something is. */
export function validateExperiment(json: unknown): ValidationResult {
  if (!isObj(json)) return { ok: false, reason: "Not an object." };
  for (const k of ["id", "title", "question", "hypothesis"] as const) {
    if (!isStr(json[k])) return { ok: false, reason: `Missing or invalid "${k}".` };
  }
  const base = json.base;
  if (
    !isObj(base) ||
    !isStr(base.system) ||
    !isStr(base.userTemplate) ||
    typeof base.temperature !== "number" ||
    typeof base.maxTokens !== "number" ||
    !isModel(base.model)
  ) {
    return { ok: false, reason: "Invalid base configuration." };
  }
  if (!Array.isArray(json.conditions) || json.conditions.length === 0) {
    return { ok: false, reason: "An experiment needs at least one condition." };
  }
  const condIds = new Set<string>();
  for (const c of json.conditions) {
    if (!isObj(c) || !isStr(c.id) || !isStr(c.label) || !isObj(c.patch)) {
      return { ok: false, reason: "Invalid condition." };
    }
    if (condIds.has(c.id)) return { ok: false, reason: `Duplicate condition id "${c.id}".` };
    condIds.add(c.id);
  }
  if (!Array.isArray(json.items) || !json.items.every((i) => isObj(i) && isStr(i.id) && isObj(i.vars))) {
    return { ok: false, reason: "Invalid items." };
  }
  if (typeof json.n !== "number" || !Number.isInteger(json.n) || json.n < 1 || json.n > MAX_N) {
    return { ok: false, reason: `"n" must be a whole number from 1 to ${MAX_N}.` };
  }
  if (!Array.isArray(json.measures)) return { ok: false, reason: "Invalid measures." };
  for (const m of json.measures) {
    if (!isObj(m) || !isStr(m.id) || !isStr(m.label) || !MEASURE_KINDS.includes(m.kind as MeasureKind)) {
      return { ok: false, reason: "Invalid measure." };
    }
    if ((m.kind === "classify" || m.kind === "rate") && !isModel(m.judge)) {
      return { ok: false, reason: `Measure "${m.id}" needs a judge model.` };
    }
  }
  if (!Array.isArray(json.runs)) return { ok: false, reason: "Invalid runs." };
  for (const r of json.runs) {
    if (!isObj(r) || !isStr(r.id) || !isStr(r.conditionId) || !isObj(r.scores) || !isStr(r.text)) {
      return { ok: false, reason: "Invalid run." };
    }
    if (!condIds.has(r.conditionId)) {
      return { ok: false, reason: `A run refers to unknown condition "${r.conditionId}".` };
    }
  }
  return { ok: true, experiment: json as unknown as Experiment };
}
