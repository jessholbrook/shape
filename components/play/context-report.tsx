"use client";

import {
  ATTRIBUTION_BLURB,
  ATTRIBUTION_LABEL,
  type Attribution,
  type ContextReport,
} from "@/lib/context-lab";

/**
 * One row per context set, and the verdict is where the answer came from
 * rather than whether it reads well. That's the whole reframe: an answer can
 * be fluent, on-brand, and sourced from a document you retired in 2019.
 */
export function ContextReportPanel({ report }: { report: ContextReport }) {
  if (report.scored === 0) return null;

  const clean = report.compromised === 0;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Where the answer came from
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {report.scored} context set{report.scored === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        {clean ? (
          <>
            Every answer came from a source you{" "}
            <span className="text-success">stand behind</span>.
          </>
        ) : (
          <>
            <span className="text-danger">
              {report.compromised} of {report.scored}
            </span>{" "}
            {report.compromised === 1 ? "answer" : "answers"}{" "}
            came from somewhere you wouldn&apos;t.
          </>
        )}
      </h2>

      <div className="flex flex-col gap-2.5">
        {report.rows.map((row) => (
          <div
            key={row.set.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink flex-1 min-w-[160px]">
              {row.set.label}
              {row.sources.length === 0 && (
                <span className="text-ink-quiet"> · no sources</span>
              )}
            </span>
            {row.runsScored > 1 && row.verdict !== "unknown" && (
              <span className="font-mono text-[10px] tabular-nums text-ink-quiet">
                {row.verdict === "unsourced"
                  ? `${row.runsScored} runs`
                  : `${row.runsMatched}/${row.runsScored} runs`}
              </span>
            )}
            <VerdictPill verdict={row.verdict} />
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {presentVerdicts(report).map((v) => (
          <p
            key={v}
            className="font-mono text-[10px] leading-[1.6] text-ink-quiet"
          >
            <span className="text-ink-muted">{ATTRIBUTION_LABEL[v]}</span> —{" "}
            {ATTRIBUTION_BLURB[v]}
          </p>
        ))}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
          Attribution is by phrase match, checked in your browser — it catches
          an answer that repeated a source, not one that quietly agreed with
          it. Read the outputs below before trusting a &ldquo;grounded.&rdquo;
        </p>
      </div>
    </div>
  );
}

function presentVerdicts(report: ContextReport): Attribution[] {
  const order: Attribution[] = [
    "injected",
    "stale",
    "grounded",
    "unsourced",
    "unknown",
  ];
  const present = new Set(report.rows.map((r) => r.verdict));
  return order.filter((v) => present.has(v));
}

function VerdictPill({ verdict }: { verdict: Attribution }) {
  const tone =
    verdict === "grounded"
      ? "bg-success/15 text-success"
      : verdict === "stale"
      ? "bg-highlight-soft text-highlight-ink"
      : verdict === "injected"
      ? "bg-danger/10 text-danger"
      : "bg-line/60 text-ink-quiet";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {ATTRIBUTION_LABEL[verdict]}
    </span>
  );
}
