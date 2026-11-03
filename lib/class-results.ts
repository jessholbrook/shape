import { analyze, type Analysis, type Experiment, type ExperimentRun } from "./experiment";
import { newId, tokenSet } from "./spread";
import { meanPairwiseSetDistance } from "./stats";
import { PROVIDERS, type ProviderId } from "./providers";
import { designFor } from "./classroom";

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
  /**
   * Null when hidden: a classmate's reported run (its scores still count).
   * Also null on a page's light rows (see lightenRows), where `hidden` says
   * which and the text loads on demand.
   */
  text: string | null;
  /** Light rows: the viewer may not see this answer. */
  hidden?: boolean;
  /** Light rows: the answer's distinct words as ids, sorted and delta-encoded. */
  words?: number[];
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

/** Whether the viewer may see this answer (light or full row). */
export function isVisible(r: ClassRunRow): boolean {
  return r.hidden === undefined ? r.text !== null : !r.hidden;
}

/**
 * Rows for the page. A class's answers and judge replies are most of its
 * bytes (about 1.2 of every 1.4 KB), and the page only needs them when
 * someone opens the run list; the scores, which every number on the page is
 * made from, stay. Timing and token counts, which only the export uses, go. What text variance needs is each answer's set of distinct
 * words, so that goes along as small integer ids — equal words, equal ids —
 * which keeps the variance exact at a fraction of the size.
 */
export function lightenRows(rows: ClassRunRow[]): ClassRunRow[] {
  const ids = new Map<string, number>();
  const idOf = (w: string) => {
    let id = ids.get(w);
    if (id === undefined) ids.set(w, (id = ids.size));
    return id;
  };
  return rows.map((r) => {
    // Timing and token counts are for the export, which reads full rows on the server.
    const { text, judge_raw, words, latency_ms, input_tokens, output_tokens, submitted_at, ...rest } = r;
    void [judge_raw, words, latency_ms, input_tokens, output_tokens, submitted_at];
    if (text === null) return { ...rest, text: null, hidden: true };
    const sorted = [...tokenSet(text)].map(idOf).sort((a, b) => a - b);
    return { ...rest, text: null, hidden: false, words: sorted.map((v, i) => (i === 0 ? v : v - sorted[i - 1])) };
  });
}

function wordSet(r: ClassRunRow): Set<string | number> | null {
  if (r.text !== null) return tokenSet(r.text);
  if (!r.words) return null;
  const out = new Set<number>();
  let v = 0;
  for (const d of r.words) out.add((v += d));
  return out;
}

/** One answer's text and judge replies, as the answers endpoints send them, in the rows' order. */
export type Answer = { run_id: string; text: string | null; judge_raw?: Record<string, string> | null };

export function answersOf(rows: ClassRunRow[]): Answer[] {
  return rows.map((r) => ({ run_id: r.run_id, text: r.text, ...(r.judge_raw ? { judge_raw: r.judge_raw } : {}) }));
}

/**
 * Light rows with their answers filled back in. Null when the two don't line
 * up — new runs arrived in between — so the caller refreshes and asks again.
 */
export function withAnswers(rows: ClassRunRow[], answers: Answer[]): ClassRunRow[] | null {
  if (answers.length !== rows.length || answers.some((a, i) => a.run_id !== rows[i].run_id)) return null;
  return rows.map((r, i) => {
    const a = answers[i];
    if (!isVisible(r)) return r;
    return { ...r, text: a.text, ...(a.judge_raw ? { judge_raw: a.judge_raw } : {}) };
  });
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
  // Same as the lab's variance, over the answers this viewer can see, from
  // text or from light rows' word ids.
  analysis.variance = e.conditions.map((c) => {
    const sets = rows
      .filter((r) => r.condition_id === c.id && r.status === "done" && isVisible(r))
      .map(wordSet)
      .filter((x): x is Set<string | number> => x !== null);
    return { conditionId: c.id, distance: meanPairwiseSetDistance(sets), n: sets.length };
  });
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

// --- Publishing ---------------------------------------------------------------------------

/** A published class result holds at most this many runs (the shared-page limit). */
export const MAX_PUBLISHED_RUNS = 2000;

export type Snapshot = { ok: true; experiment: Experiment } | { ok: false; message: string };

/**
 * The class's results as a shared experiment, built on the server from the
 * class's own records: one answering model, only runs recorded by Shape (a
 * reported run's answer came from a browser, so it can't be vouched for in
 * public), no nicknames. The teacher's design, title and locked hypothesis
 * travel with it, so a reader can check the manifest and rerun it.
 */
export function classSnapshot(
  cls: { title: string; experiment: Experiment },
  rows: ClassRunRow[],
  model: string,
  now: number,
): Snapshot {
  const slash = model.indexOf("/");
  if (slash < 1) return { ok: false, message: "Pick a model to publish." };
  const recorded = rows.filter((r) => r.recorded && modelKey(r) === model && (r.status === "done" || r.status === "error"));
  if (!recorded.length) {
    return {
      ok: false,
      message: "No runs for that model were recorded by Shape. Only runs answered through Shape's free tier can be published.",
    };
  }
  if (recorded.length > MAX_PUBLISHED_RUNS) {
    return { ok: false, message: `That's ${recorded.length} runs; a published result holds at most ${MAX_PUBLISHED_RUNS}. Download the CSV instead.` };
  }
  const students = new Set(recorded.map((r) => r.nickname ?? "")).size;
  const latest = Math.max(...recorded.map((r) => (r.submitted_at ? Date.parse(r.submitted_at) : 0)));
  const design = designFor(cls.experiment, { provider: model.slice(0, slash) as ProviderId, model: model.slice(slash + 1) });
  // Ids are positional: run ids repeat across students, and nicknames stay out.
  const runs = toExperimentRuns(recorded.map((r) => ({ ...r, nickname: undefined })));
  return {
    ok: true,
    experiment: {
      ...design,
      id: newId("exp"),
      title: cls.title,
      runs,
      forkedFrom: undefined,
      classPool: { students, runs: runs.length, recordedBy: "shape" },
      updatedAt: Number.isFinite(latest) && latest > 0 ? latest : now,
    },
  };
}
