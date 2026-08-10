"use client";

import { assertionLabel, type StabilityReport } from "@/lib/spread";

/**
 * The headline of the whole playground: not "here are N outputs," but "your
 * spec held on X of Y clauses." Each row is a hit rate over the completed
 * runs, so a clause that works four times out of ten reads as a coin flip
 * rather than a success.
 */
export function StabilityReportPanel({ report }: { report: StabilityReport }) {
  if (report.runCount === 0 || report.total === 0) return null;

  const allHeld = report.held === report.total;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Stability report
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          over {report.runCount} run{report.runCount === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        Your spec held on{" "}
        <span className={allHeld ? "text-success" : "text-ink"}>
          {report.held} of {report.total}
        </span>{" "}
        {report.total === 1 ? "clause" : "clauses"}.
      </h2>

      <div className="flex flex-col gap-2.5">
        {report.results.map((r) => (
          <div
            key={r.assertion.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1"
          >
            <span
              className={`font-mono text-[11px] flex-1 min-w-[180px] ${
                r.held ? "text-ink-muted" : "text-ink"
              }`}
            >
              {assertionLabel(r.assertion)}
            </span>
            <Meter hits={r.hits} total={r.total} held={r.held} />
            <span
              className={`font-mono text-[11px] tabular-nums w-14 text-right ${
                r.held ? "text-success" : "text-danger"
              }`}
            >
              {r.hits}/{r.total}
            </span>
          </div>
        ))}
      </div>

      <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet border-t border-line pt-3">
        Checked in your browser — no extra model calls. These catch mechanical
        drift (length, forbidden words, required mentions), not tonal drift.
        For tone, read the outliers below and diff two runs against each other.
      </p>
    </div>
  );
}

function Meter({
  hits,
  total,
  held,
}: {
  hits: number;
  total: number;
  held: boolean;
}) {
  const pct = total === 0 ? 0 : (hits / total) * 100;
  return (
    <span
      className="h-1.5 w-32 rounded-full bg-line/70 overflow-hidden shrink-0"
      role="img"
      aria-label={`${hits} of ${total} runs passed`}
    >
      <span
        className={`block h-full rounded-full ${
          held ? "bg-success" : "bg-danger"
        }`}
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
