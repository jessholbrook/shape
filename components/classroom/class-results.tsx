"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Experiment } from "@/lib/experiment";
import { ALL, defaultFilter, filterRows, modelLabel, modelsIn, pooled, studentsIn, type ClassRunRow, type ResultFilter } from "@/lib/class-results";
import { Findings, ResultsTable, RunList } from "@/components/lab/results";
import { INPUT, LINK_BUTTON, Label, PANEL, PanelHeader } from "@/components/lab/fields";

/**
 * The class's results, pooled. The teacher sees every run by name and can
 * look at one student; a student sees the class anonymously, with
 * classmates' self-reported answers hidden (their scores still count).
 *
 * Starts on the most-run model: pooling is sound within one model and
 * misleading across several, so "all models" is offered but labelled mixed.
 */
export function ClassResults({ experiment, rows, view }: { experiment: Experiment; rows: ClassRunRow[]; view: "teacher" | "student" }) {
  const router = useRouter();
  const [filter, setFilter] = useState<ResultFilter>(() => defaultFilter(rows));
  const models = useMemo(() => modelsIn(rows), [rows]);
  const students = useMemo(() => studentsIn(rows), [rows]);
  // A refresh can drop the chosen model or student; fall back rather than show nothing.
  const f: ResultFilter = useMemo(
    () => ({
      model: filter.model === ALL || models.some((m) => m.key === filter.model) ? filter.model : (models[0]?.key ?? ALL),
      source: filter.source,
      student: filter.student === ALL || students.includes(filter.student) ? filter.student : ALL,
    }),
    [filter, models, students],
  );
  const shown = useMemo(() => filterRows(rows, f), [rows, f]);
  const { experiment: withRuns, analysis } = useMemo(() => pooled(experiment, shown), [experiment, shown]);
  const visible = useMemo(() => ({ ...withRuns, runs: withRuns.runs.filter((_, i) => shown[i].text !== null) }), [withRuns, shown]);
  const hidden = shown.length - visible.runs.length;
  const recorded = shown.filter((r) => r.recorded).length;
  const mine = rows.filter((r) => r.mine).length;
  const mixed = f.model === ALL && models.length > 1;

  const refresh = (
    <button type="button" className={LINK_BUTTON} onClick={() => router.refresh()}>
      Refresh
    </button>
  );

  if (rows.length === 0) {
    return (
      <section className={PANEL} aria-label="Class results" data-testid="class-results">
        <PanelHeader num="Class" title="The class's results" action={refresh} />
        <p className="font-sans text-[14px] text-ink-muted">
          No runs yet. {view === "teacher" ? "Results appear here as students finish." : "Yours will be the first."}
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="class-results">
      <section className={PANEL} aria-label="Class results">
        <PanelHeader num="Class" title="The class's results" action={refresh} />
        <div className={`grid grid-cols-1 gap-3 ${view === "teacher" ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <div>
            <Label htmlFor="results-model">Results for model</Label>
            <select
              id="results-model"
              value={f.model}
              onChange={(ev) => setFilter({ ...f, model: ev.target.value })}
              className={`${INPUT} font-mono text-[13px]`}
            >
              {models.map((m) => (
                <option key={m.key} value={m.key}>
                  {modelLabel(m.key)} — {m.runs} {m.runs === 1 ? "run" : "runs"}
                </option>
              ))}
              {models.length > 1 && <option value={ALL}>All models (mixed)</option>}
            </select>
          </div>
          <div>
            <Label htmlFor="results-source">Runs</Label>
            <select
              id="results-source"
              value={f.source}
              onChange={(ev) => setFilter({ ...f, source: ev.target.value === "recorded" ? "recorded" : "all" })}
              className={INPUT}
            >
              <option value="all">All runs</option>
              <option value="recorded">Recorded by Shape only</option>
            </select>
          </div>
          {view === "teacher" && (
            <div>
              <Label htmlFor="results-student">Student</Label>
              <select id="results-student" value={f.student} onChange={(ev) => setFilter({ ...f, student: ev.target.value })} className={INPUT}>
                <option value={ALL}>Everyone</option>
                {students.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="font-sans text-[14px] text-ink-muted" data-testid="class-results-summary">
          <span className="text-ink">
            {shown.length} {shown.length === 1 ? "run" : "runs"}
          </span>
          {" · "}
          {recorded === shown.length ? "all" : recorded} recorded by Shape
          {view === "student" && mine > 0 && ` · ${mine} of the class's ${rows.length} are yours`}
        </p>
        {mixed && (
          <p className="font-sans text-[13px] leading-[1.5] text-warning">
            These runs come from {models.length} different models. Pooling them blends how different models behave into
            one number — pick a model to compare like with like.
          </p>
        )}
        {recorded < shown.length && (
          <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet border-t border-line pt-3">
            <em>Recorded by Shape</em>: answered through Shape&apos;s free tier, so the answer and every score were checked
            on the server. <em>Reported</em>: run on a student&apos;s own key and sent from their browser — usually fine,
            but not checked. If a result hinges on reported runs, look at it with recorded runs only.
          </p>
        )}
      </section>

      {shown.length === 0 ? (
        <p className="font-sans text-[14px] text-ink-muted">No runs match. Try another model, or all runs.</p>
      ) : (
        <>
          <Findings experiment={withRuns} analysis={analysis} />
          <ResultsTable experiment={withRuns} analysis={analysis} />
          <RunList experiment={visible} />
          {hidden > 0 && (
            <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet -mt-3">
              {hidden} {hidden === 1 ? "answer" : "answers"} reported by classmates {hidden === 1 ? "isn't" : "aren't"} shown —
              their scores count above. Your teacher can see them.
            </p>
          )}
        </>
      )}
    </div>
  );
}
