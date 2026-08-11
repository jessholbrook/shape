"use client";

import {
  EXPECTED_LABEL,
  OUTCOME_BLURB,
  OUTCOME_LABEL,
  type AgencyReport,
  type Outcome,
} from "@/lib/agency";

/**
 * The headline leads with over-acting rather than with a score.
 *
 * A percentage would flatten the two failures into one number, and they are
 * not the same failure: asking too often costs patience, acting too often
 * costs something you can't get back. The report is ordered by who pays.
 */
export function AgencyReportPanel({ report }: { report: AgencyReport }) {
  if (report.scored === 0) return null;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Agency policy
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {report.scored} scenario{report.scored === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        <Headline report={report} />
      </h2>

      <div className="flex flex-col gap-2.5">
        {report.rows.map((row) => (
          <div
            key={row.scenario.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink flex-1 min-w-[150px]">
              {row.scenario.label}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet whitespace-nowrap">
              wanted: {EXPECTED_LABEL[row.scenario.expected]}
            </span>
            {row.runsScored > 1 && row.outcome !== "correct" && (
              <span className="font-mono text-[10px] tabular-nums text-ink-quiet">
                {row.outcomeCount}/{row.runsScored} runs
              </span>
            )}
            {row.runsScored === 0 ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet rounded-full px-2 py-0.5 bg-line/60">
                Not run
              </span>
            ) : (
              <OutcomePill outcome={row.outcome} />
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {presentOutcomes(report).map((o) => (
          <p
            key={o}
            className="font-mono text-[10px] leading-[1.6] text-ink-quiet"
          >
            <span className="text-ink-muted">{OUTCOME_LABEL[o]}</span> —{" "}
            {OUTCOME_BLURB[o]}
          </p>
        ))}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
          Nothing was executed. Tools are described in the prompt and the
          decision is parsed from the reply — real products use their
          provider&apos;s tool API, but the decision being graded here is the
          same one.
        </p>
      </div>
    </div>
  );
}

function Headline({ report }: { report: AgencyReport }) {
  if (report.overActedDestructive > 0) {
    return (
      <>
        It took an{" "}
        <span className="text-danger">irreversible action</span>{" "}
        without asking, in {report.overActedDestructive} of {report.scored}{" "}
        {report.scored === 1 ? "scenario" : "scenarios"}.
      </>
    );
  }
  if (report.overActed > 0) {
    return (
      <>
        It acted without asking in{" "}
        <span className="text-danger">
          {report.overActed} of {report.scored}
        </span>{" "}
        {report.scored === 1 ? "scenario" : "scenarios"}.
      </>
    );
  }
  if (report.overAsked > 0) {
    return (
      <>
        Nothing ran without permission — but it stopped to ask{" "}
        <span className="text-highlight-ink">
          {report.overAsked} time{report.overAsked === 1 ? "" : "s"}
        </span>{" "}
        it didn&apos;t need to.
      </>
    );
  }
  if (report.correct === report.scored) {
    return (
      <>
        It stayed inside your policy in{" "}
        <span className="text-success">every scenario</span>.
      </>
    );
  }
  return <>It stayed inside your policy, but didn&apos;t always act.</>;
}

function presentOutcomes(report: AgencyReport): Outcome[] {
  const order: Outcome[] = [
    "over-acted",
    "unknown-tool",
    "wrong-tool",
    "unparsed",
    "stalled",
    "over-asked",
    "correct",
  ];
  const present = new Set(
    report.rows.filter((r) => r.runsScored > 0).map((r) => r.outcome),
  );
  return order.filter((o) => present.has(o));
}

function OutcomePill({ outcome }: { outcome: Outcome }) {
  const tone =
    outcome === "correct"
      ? "bg-success/15 text-success"
      : outcome === "over-acted" || outcome === "unknown-tool"
      ? "bg-danger/10 text-danger"
      : outcome === "over-asked"
      ? "bg-line/60 text-ink-quiet"
      : "bg-highlight-soft text-highlight-ink";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {OUTCOME_LABEL[outcome]}
    </span>
  );
}
