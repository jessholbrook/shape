"use client";

import {
  REPAIR_BLURB,
  REPAIR_LABEL,
  type RepairOutcome,
  type RepairReport,
} from "@/lib/agency";

/**
 * What the model did after an action failed. Scored only for scenarios in
 * which a failing stub was actually fed back, and led by the outcome an
 * incident review is about: a reply that reads as success after a failure.
 *
 * "Glossed over" is a heuristic — text after a failure that mentions none of
 * it — and the footer says so. The runs are right there to read.
 */
export function RepairReportPanel({ report }: { report: RepairReport }) {
  if (report.scored === 0) return null;
  const n = report.scored;
  const noun = n === 1 ? "scenario" : "scenarios";

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Repair — after a failed action
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {n} {noun} with a failure
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        {report.glossed > 0 ? (
          <>
            It <span className="text-danger">glossed over</span> a failed
            action in {report.glossed} of {n} {noun}.
          </>
        ) : report.keptGoing > 0 ? (
          <>
            It <span className="text-highlight-ink">kept calling tools</span>{" "}
            after a failure in {report.keptGoing} of {n} {noun}, and never
            reported back.
          </>
        ) : report.reported === n ? (
          <>
            It <span className="text-success">reported every failure</span>{" "}
            to the user.
          </>
        ) : (
          <>After the failure it asked, retried, or switched — read the runs.</>
        )}
      </h2>

      <div className="flex flex-col gap-2.5">
        {report.rows
          .filter((row) => row.runsWithFailure > 0)
          .map((row) => (
            <div
              key={row.scenario.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 first:border-t-0 first:pt-0"
            >
              <span className="font-mono text-[11px] text-ink flex-1 min-w-[150px]">
                {row.scenario.label}
              </span>
              {row.failedTool && (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet whitespace-nowrap">
                  {row.failedTool} failed
                </span>
              )}
              {row.runsWithFailure > 1 && (
                <span className="font-mono text-[10px] tabular-nums text-ink-quiet">
                  {row.outcomeCount}/{row.runsWithFailure} runs
                </span>
              )}
              <RepairPill outcome={row.outcome} />
            </div>
          ))}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {presentOutcomes(report).map((o) => (
          <p key={o} className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
            <span className="text-ink-muted">{REPAIR_LABEL[o]}</span> —{" "}
            {REPAIR_BLURB[o]}
          </p>
        ))}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
          &ldquo;Glossed over&rdquo; is a heuristic: a reply after a failure
          that mentions nothing about failing. Read the run before you quote
          it. The failures themselves are the stub results you wrote — the
          model never executed anything.
        </p>
      </div>
    </div>
  );
}

function presentOutcomes(report: RepairReport): RepairOutcome[] {
  const order: RepairOutcome[] = [
    "glossed",
    "kept-going",
    "retried",
    "switched",
    "asked",
    "reported",
  ];
  const present = new Set(
    report.rows.filter((r) => r.runsWithFailure > 0).map((r) => r.outcome),
  );
  return order.filter((o) => present.has(o));
}

export function RepairPill({ outcome }: { outcome: RepairOutcome }) {
  const tone =
    outcome === "glossed"
      ? "bg-danger/10 text-danger"
      : outcome === "reported" || outcome === "asked"
        ? "bg-success/15 text-success"
        : outcome === "none"
          ? "bg-line/60 text-ink-quiet"
          : "bg-highlight-soft text-highlight-ink";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {REPAIR_LABEL[outcome]}
    </span>
  );
}
