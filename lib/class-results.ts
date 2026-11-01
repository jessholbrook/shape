import { analyze, type Analysis, type Experiment, type ExperimentRun } from "./experiment";
import { PROVIDERS, type ProviderId } from "./providers";

/**
 * A class's pooled results: every student's runs of the same experiment,
 * analysed together.
 *
 * Pooling is sound here because the unit is the model call, not the student:
 * every student sends the same prompts, so each run is another independent
 * draw from the same model. That only holds within one model — mixing models
 * mixes two different things — so the view picks one model by default and
 * labels "all models" as mixed.
 *
 * Pure: the class pages and the export use it; tests run it without a server.
 */

export type ClassRunRow = {
  run_id: string;
  condition_id: string;
  item_id: string | null;
  idx: number;
  provider: ProviderId;
  model: string;
  status: "done" | "error";
  scores: Record<string, boolean | number | null>;
  /** Answered through Shape's free tier and checked against its record. */
  recorded: boolean;
  /** Null when hidden: a classmate's reported run (its scores still count). */
  text: string | null;
  /** Student view: this student's own run. */
  mine?: boolean;
  /** Teacher view only. */
  nickname?: string;
  error?: string | null;
  judge_raw?: Record<string, string> | null;
  latency_ms?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  submitted_at?: string;
};

export const ALL = "all";
export type Source = "all" | "recorded";
export type ResultFilter = { model: string; source: Source; student: string };

export const modelKey = (r: Pick<ClassRunRow, "provider" | "model">) => `${r.provider}/${r.model}`;

/** "claude-haiku-4-5 · free tier", "gpt-5 · OpenAI" — short enough for a narrow select. */
export function modelLabel(key: string): string {
  const slash = key.indexOf("/");
  const provider = key.slice(0, slash) as ProviderId;
  const model = key.slice(slash + 1);
  return `${model} · ${provider === "shape-free" ? "free tier" : (PROVIDERS[provider]?.name ?? provider)}`;
}

export type ModelCount = { key: string; runs: number; recorded: number };

/** The models in the class's runs, most-run first. */
export function modelsIn(rows: ClassRunRow[]): ModelCount[] {
  const counts = new Map<string, ModelCount>();
  for (const r of rows) {
    const key = modelKey(r);
    const c = counts.get(key) ?? { key, runs: 0, recorded: 0 };
    c.runs += 1;
    if (r.recorded) c.recorded += 1;
    counts.set(key, c);
  }
  return [...counts.values()].sort((a, b) => b.runs - a.runs || a.key.localeCompare(b.key));
}

/** Start on the most-run model — never on a mix. */
export function defaultFilter(rows: ClassRunRow[]): ResultFilter {
  return { model: modelsIn(rows)[0]?.key ?? ALL, source: "all", student: ALL };
}

export function studentsIn(rows: ClassRunRow[]): string[] {
  return [...new Set(rows.map((r) => r.nickname).filter((n): n is string => !!n))];
}

export function filterRows(rows: ClassRunRow[], f: ResultFilter): ClassRunRow[] {
  return rows.filter(
    (r) =>
      (f.model === ALL || modelKey(r) === f.model) &&
      (f.source === "all" || r.recorded) &&
      (f.student === ALL || r.nickname === f.student),
  );
}

/** Rows as lab runs, so the lab's findings, table and run list work unchanged. */
export function toExperimentRuns(rows: ClassRunRow[]): ExperimentRun[] {
  return rows.map((r, i) => ({
    id: `${i}:${r.run_id}`,
    conditionId: r.condition_id,
    itemId: r.item_id,
    index: r.idx,
    status: r.status,
    text: r.text ?? "",
    ...(r.error ? { error: r.error } : {}),
    requestedModel: r.model,
    scores: r.scores ?? {},
    ...(r.judge_raw ? { judgeRaw: r.judge_raw } : {}),
  }));
}

/**
 * The class's experiment with these runs, and its analysis. Text variance is
 * computed only over answers the viewer can see: a hidden answer isn't an
 * empty one.
 */
export function pooled(e: Experiment, rows: ClassRunRow[]): { experiment: Experiment; analysis: Analysis } {
  const experiment: Experiment = { ...e, runs: toExperimentRuns(rows) };
  const analysis = analyze(experiment);
  if (rows.some((r) => r.text === null)) {
    analysis.variance = analyze({ ...e, runs: toExperimentRuns(rows.filter((r) => r.text !== null)) }).variance;
  }
  return { experiment, analysis };
}

// --- Export ------------------------------------------------------------------------------

/**
 * One cell of CSV. Every text cell is quoted; one that a spreadsheet would
 * read as a formula (=, +, -, @, tab, return) gets a leading apostrophe, since
 * nicknames and reported answers are typed by students.
 */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return v ? "true" : "false";
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Every run, one per row, with each measure as a column. For the teacher. */
export function toCsv(e: Experiment, rows: ClassRunRow[]): string {
  const cond = (id: string) => e.conditions.find((c) => c.id === id)?.label ?? id;
  const item = (id: string | null) => (id ? (e.items.find((i) => i.id === id)?.label ?? id) : "");
  const header = [
    "student",
    "condition",
    "item",
    "repeat",
    "provider",
    "model",
    "source",
    "status",
    ...e.measures.map((m) => m.label),
    "latency_ms",
    "input_tokens",
    "output_tokens",
    "submitted_at",
    "error",
    "answer",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.nickname ?? "",
        cond(r.condition_id),
        item(r.item_id),
        r.idx + 1,
        r.provider,
        r.model,
        r.recorded ? "recorded by Shape" : "reported by student",
        r.status,
        ...e.measures.map((m) => r.scores?.[m.id] ?? null),
        r.latency_ms ?? null,
        r.input_tokens ?? null,
        r.output_tokens ?? null,
        r.submitted_at ?? "",
        r.error ?? "",
        r.text ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  // CRLF and a byte-order mark: what spreadsheet apps expect for UTF-8 CSV.
  return `﻿${lines.join("\r\n")}\r\n`;
}
