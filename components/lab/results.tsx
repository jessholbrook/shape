"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildManifest,
  ranAtOf,
  isClear,
  manifestHash,
  summarize,
  type Analysis,
  type CellStat,
  type Experiment,
  type ExperimentRun,
  type Measure,
  type Runner,
} from "@/lib/experiment";
import { EYEBROW, LINK_BUTTON, PANEL, PanelHeader } from "./fields";

const pct = (x: number) => `${Math.round(x * 100)}%`;

// --- Findings ------------------------------------------------------------------

/**
 * One sentence per comparison. Clear differences lead; "no clear
 * difference" follows in quieter type — still reported, because a null
 * result is a result.
 */
export function Findings({ experiment: e, analysis: a }: { experiment: Experiment; analysis: Analysis }) {
  const clear = a.comparisons.filter(isClear);
  const unclear = a.comparisons.filter((c) => !isClear(c));
  return (
    <section className={PANEL} aria-label="Findings">
      <PanelHeader num="Findings" title={clear.length ? "What changed" : "No clear differences yet"} />
      {e.conditions.length < 2 ? (
        <p className="font-sans text-[14px] text-ink-muted">
          Add a second condition to compare against the baseline. With one condition, the table below describes it.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {clear.map((c) => (
            <li key={`${c.measureId}-${c.conditionId}`} className="font-sans text-[16px] leading-[1.5] text-ink">
              {summarize(e, c)}
            </li>
          ))}
          {unclear.map((c) => (
            <li key={`${c.measureId}-${c.conditionId}`} className="font-sans text-[14px] leading-[1.5] text-ink-muted">
              {summarize(e, c)}
            </li>
          ))}
        </ul>
      )}
      {a.manyComparisons && (
        <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet border-t border-line pt-3">
          You&apos;re making {a.comparisons.length} comparisons. At 95% intervals, about one in twenty clear-looking
          differences is chance — treat a lone surprise as a lead, not a finding.
        </p>
      )}
      <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet border-t border-line pt-3">
        Brackets are 95% intervals: the range of true values these runs are consistent with. Wide brackets mean run
        more, not &ldquo;no effect&rdquo;.
      </p>
    </section>
  );
}

// --- Per-measure results with interval bars -----------------------------------------

/**
 * Point plus 95% interval on a fixed 0–100% track. Emphasis form: the
 * baseline is drawn in neutral gray, other conditions in the accent, so the
 * eye goes to the change. Identity comes from the row label, never color
 * alone; the numbers beside the bar are the table view.
 */
function IntervalBar({ p, lo, hi, baseline, label }: { p: number; lo: number; hi: number; baseline: boolean; label: string }) {
  const [hover, setHover] = useState(false);
  const tone = baseline ? "bg-ink-quiet" : "bg-highlight";
  return (
    <span
      className="relative block h-5 w-full min-w-[140px] cursor-default"
      role="img"
      aria-label={label}
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      {/* Track: hairline with quarter ticks, recessive. */}
      <span className="absolute left-0 right-0 top-1/2 h-px bg-line" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <span key={t} className="absolute top-[30%] h-[40%] w-px bg-line" style={{ left: `${t * 100}%` }} />
      ))}
      {/* Interval: 2px line. */}
      <span
        className={`absolute top-1/2 -translate-y-1/2 h-[2px] rounded-full ${tone}`}
        style={{ left: `${lo * 100}%`, width: `${Math.max(0, hi - lo) * 100}%` }}
      />
      {/* Point: 8px with a 2px surface ring. */}
      <span
        className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-surface ${tone}`}
        style={{ left: `${p * 100}%` }}
      />
      {hover && (
        <span className="absolute z-10 bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-ink text-canvas font-mono text-[11px] px-2 py-1 pointer-events-none">
          {label}
        </span>
      )}
    </span>
  );
}

function CellRow({
  cell,
  conditionLabel,
  baseline,
}: {
  cell: CellStat;
  conditionLabel: string;
  baseline: boolean;
}) {
  const excluded = cell.excluded > 0 ? ` · ${cell.excluded} excluded` : "";
  if (cell.kind === "binary") {
    const label = `${conditionLabel}: ${pct(cell.rate.p)}, plausibly ${pct(cell.rate.lo)} to ${pct(cell.rate.hi)} — ${cell.k} of ${cell.n}`;
    return (
      <div className="grid grid-cols-1 md:grid-cols-[minmax(160px,1fr)_minmax(160px,2fr)_auto] items-center gap-x-5 gap-y-1.5 py-2">
        <span className="font-sans text-[14px] text-ink">
          {conditionLabel}
          {baseline && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">baseline</span>}
        </span>
        <IntervalBar p={cell.rate.p} lo={cell.rate.lo} hi={cell.rate.hi} baseline={baseline} label={label} />
        <span className="font-mono text-[12px] tabular-nums text-ink-muted md:text-right">
          <span className="text-ink">{pct(cell.rate.p)}</span> [{pct(cell.rate.lo)}–{pct(cell.rate.hi)}] · {cell.k}/{cell.n}
          {excluded}
        </span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(160px,1fr)_auto] items-center gap-x-5 gap-y-1 py-2">
      <span className="font-sans text-[14px] text-ink">
        {conditionLabel}
        {baseline && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">baseline</span>}
      </span>
      <span className="font-mono text-[12px] tabular-nums text-ink-muted md:text-right">
        mean <span className="text-ink">{cell.mean.toFixed(1)}</span> ± {cell.sd.toFixed(1)} · n {cell.n}
        {excluded}
      </span>
    </div>
  );
}

export function ResultsTable({ experiment: e, analysis: a }: { experiment: Experiment; analysis: Analysis }) {
  const condLabel = (id: string) => e.conditions.find((c) => c.id === id)?.label ?? id;
  return (
    <section className={PANEL} aria-label="Results by measure">
      <PanelHeader num="Results" title="By measure" />
      {e.measures.map((m) => (
        <MeasureBlock key={m.id} measure={m} cells={a.cells.filter((c) => c.measureId === m.id)} condLabel={condLabel} baselineId={e.conditions[0]?.id} />
      ))}
      <div>
        <p className={EYEBROW}>Run-to-run variation</p>
        <ul className="mt-2 flex flex-col gap-1">
          {a.variance.map((v) => (
            <li key={v.conditionId} className="font-mono text-[12px] text-ink-muted flex justify-between gap-4">
              <span className="font-sans text-[14px] text-ink">{condLabel(v.conditionId)}</span>
              <span className="tabular-nums">
                {v.distance === null ? "needs 2+ runs" : `${pct(v.distance)} different words, on average`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function MeasureBlock({
  measure: m,
  cells,
  condLabel,
  baselineId,
}: {
  measure: Measure;
  cells: CellStat[];
  condLabel: (id: string) => string;
  baselineId?: string;
}) {
  const judged = m.kind === "classify" || m.kind === "rate";
  return (
    <div className="border-t border-line pt-3">
      <p className="font-display text-[20px] leading-[1.2] text-ink">{m.label}</p>
      <p className="font-sans text-[12px] text-ink-quiet mt-0.5">
        {m.kind === "classify" && `Judged by ${m.judge.model}: “${m.question}” — hit = ${m.target}`}
        {m.kind === "rate" && `Judged by ${m.judge.model} on 1–${m.scale}: “${m.rubric}”`}
        {m.kind === "assertion" && "Exact text check"}
        {m.kind === "regex" && <span title={`/${m.pattern}/${m.flags ?? ""}`}>{m.describe ?? `Pattern /${m.pattern}/${m.flags ?? ""}`}</span>}
        {m.kind === "length" && "Words per answer"}
        {judged && " · a model's call, not ground truth"}
      </p>
      <div className="mt-1 divide-y divide-line/60">
        {cells.map((c) => (
          <CellRow key={c.conditionId} cell={c} conditionLabel={condLabel(c.conditionId)} baseline={c.conditionId === baselineId} />
        ))}
      </div>
    </div>
  );
}

// --- Runs ----------------------------------------------------------------------

export function RunList({ experiment: e }: { experiment: Experiment }) {
  const [open, setOpen] = useState(false);
  const condLabel = (id: string) => e.conditions.find((c) => c.id === id)?.label ?? id;
  const itemLabel = (id: string | null) => (id ? e.items.find((i) => i.id === id)?.label ?? id : "");
  return (
    <section className={PANEL} aria-label="Runs">
      <PanelHeader
        num="Runs"
        title={`Every answer (${e.runs.length})`}
        action={
          <button type="button" className={LINK_BUTTON} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Show"} runs
          </button>
        }
      />
      {open && (
        <ol className="flex flex-col gap-2">
          {e.runs.map((r) => (
            <RunRow key={r.id} run={r} measures={e.measures} heading={[condLabel(r.conditionId), itemLabel(r.itemId), `run ${r.index + 1}`].filter(Boolean).join(" · ")} />
          ))}
        </ol>
      )}
    </section>
  );
}

function scoreText(v: boolean | number | null | undefined): string {
  if (v === true) return "yes";
  if (v === false) return "no";
  if (v === null || v === undefined) return "—";
  return String(v);
}

function RunRow({ run, measures, heading }: { run: ExperimentRun; measures: Measure[]; heading: string }) {
  return (
    <li className="border border-line rounded-[12px] p-3 bg-canvas/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={EYEBROW}>{heading}</span>
        <span className="font-mono text-[11px] text-ink-quiet">
          {run.status === "error" ? <span className="text-danger">error — {run.error}</span> : run.status}
        </span>
      </div>
      {run.text && <p className="font-sans text-[13px] leading-[1.55] text-ink mt-2 whitespace-pre-wrap">{run.text}</p>}
      {run.status === "done" && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {measures.map((m) => (
            <li key={m.id} className="font-mono text-[11px] text-ink-muted" title={run.judgeRaw?.[m.id]}>
              {m.label}: <span className="text-ink">{scoreText(run.scores[m.id])}</span>
              {run.judgeRaw?.[m.id] !== undefined && run.scores[m.id] === null && " (judge reply unparseable)"}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// --- Manifest ------------------------------------------------------------------

export function ManifestPanel({ experiment: e, runner }: { experiment: Experiment; runner: Runner }) {
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const manifest = useMemo(
    () =>
      buildManifest(e, {
        appVersion: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? "local",
        ranAt: ranAtOf(e),
        runner,
      }),
    [e, runner],
  );
  useEffect(() => {
    let live = true;
    manifestHash(manifest).then((h) => live && setHash(h));
    return () => {
      live = false;
    };
  }, [manifest]);
  const json = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);

  return (
    <section className={PANEL} aria-label="Manifest">
      <PanelHeader
        num="Manifest"
        title="What exactly was run"
        hint="Everything needed to rerun this: models, settings, and every prompt as sent. No keys."
        action={
          <div className="flex items-center gap-4">
            <button
              type="button"
              className={LINK_BUTTON}
              onClick={() => {
                navigator.clipboard?.writeText(json).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                });
              }}
            >
              {copied ? "Copied" : "Copy JSON"}
            </button>
            <button type="button" className={LINK_BUTTON} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide" : "Show"}
            </button>
          </div>
        }
      />
      <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[12px]">
        <div>
          <dt className={EYEBROW}>Models</dt>
          <dd className="text-ink mt-1 break-all">
            {manifest.models.requested.join(", ")}
            {manifest.models.resolved.length > 0 && (
              <span className="block text-ink-muted">served: {manifest.models.resolved.join(", ")}</span>
            )}
          </dd>
        </div>
        <div>
          <dt className={EYEBROW}>Runs</dt>
          <dd className="text-ink mt-1">
            N = {manifest.params.n} per cell · temp {manifest.params.temperature.join(", ")}
          </dd>
        </div>
        <div>
          <dt className={EYEBROW}>Fingerprint</dt>
          <dd className="text-ink mt-1 break-all">{hash ? hash.slice(0, 16) : "…"}</dd>
        </div>
      </dl>
      {open && (
        <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-[1.55] text-ink-muted bg-canvas border border-line rounded-[10px] p-3">
          {json}
        </pre>
      )}
    </section>
  );
}
