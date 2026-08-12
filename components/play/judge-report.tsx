"use client";

import {
  VERDICT_BLURB,
  VERDICT_LABEL,
  type JudgeReport,
  type PairVerdict,
} from "@/lib/judge";

/**
 * Consistency leads, agreement follows.
 *
 * That order is the argument. Agreement is the number people quote and the
 * one that means least on its own: a judge can match your picks most of the
 * time and still be reading position, in which case the matches were luck. So
 * the headline states the flip rate first and only then says how often it
 * agreed — and when the flip rate is high, it says the agreement doesn't count.
 */
export function JudgeReportPanel({ report }: { report: JudgeReport }) {
  if (report.scored === 0) return null;

  const clean = report.flipped === 0;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Calibration
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {report.scored} pair{report.scored === 1 ? "" : "s"}, judged both ways
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        {clean ? (
          <>
            Your judge{" "}
            <span className="text-success">held its answer</span>{" "}
            on every pair when the order changed.
          </>
        ) : (
          <>
            Your judge{" "}
            <span className="text-danger">
              changed its answer on {report.flipped} of {report.scored}
            </span>{" "}
            {report.flipped === 1 ? "pair" : "pairs"} when we swapped the
            order.
          </>
        )}
      </h2>

      <AgreementLine report={report} clean={clean} />

      <div className="flex flex-col gap-2.5">
        {report.rows.map((row) => (
          <div
            key={row.pair.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink flex-1 min-w-[140px]">
              {row.pair.label}
            </span>
            {row.pair.humanPick && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet whitespace-nowrap">
                you: {row.pair.humanPick.toUpperCase()}
              </span>
            )}
            {row.verdict !== "incomplete" && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet whitespace-nowrap">
                judge: {pickLabel(row.pickAB)} / {pickLabel(row.pickBA)}
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
            <span className="text-ink-muted">{VERDICT_LABEL[v]}</span> —{" "}
            {VERDICT_BLURB[v]}
          </p>
        ))}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
          Each pair is judged twice — once as written, once with the two
          answers swapped. That&apos;s why this costs double a plain scoring
          run, and it&apos;s the only way to tell a verdict from a coin flip.
        </p>
      </div>
    </div>
  );
}

/**
 * The agreement number, deliberately qualified. Reporting "agreed on 4 of 5"
 * next to a high flip rate would be the exact mistake this module is about.
 */
function AgreementLine({
  report,
  clean,
}: {
  report: JudgeReport;
  clean: boolean;
}) {
  if (report.comparable === 0) {
    return (
      <p className="font-sans text-[15px] leading-[1.5] text-ink-muted">
        No pairs had both a steady verdict and a pick of your own to compare
        it against.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-[15px] leading-[1.5] text-ink">
        Where it held steady, it agreed with you on{" "}
        <strong>
          {report.agrees} of {report.comparable}
        </strong>
        .
        {!clean && (
          <>
            {" "}
            <span className="text-ink-muted">
              That number only covers the pairs it didn&apos;t flip on — the
              rest agreed or disagreed by position, which is to say by
              accident.
            </span>
          </>
        )}
      </p>
      {report.favouredPosition && report.favouredCount > 1 && (
        <p className="font-sans text-[15px] leading-[1.5] text-ink-muted">
          On {report.favouredCount} of the flips it named the{" "}
          {report.favouredPosition === 1 ? "first" : "second"} answer both
          times — a lean, not just noise.
        </p>
      )}
    </div>
  );
}

function pickLabel(pick: string): string {
  if (pick === "a" || pick === "b") return pick.toUpperCase();
  if (pick === "tie") return "tie";
  return "—";
}

function presentVerdicts(report: JudgeReport): PairVerdict[] {
  const order: PairVerdict[] = [
    "position-flipped",
    "unparsed",
    "tie",
    "disagrees",
    "agrees",
    "incomplete",
  ];
  const present = new Set(report.rows.map((r) => r.verdict));
  return order.filter((v) => present.has(v));
}

function VerdictPill({ verdict }: { verdict: PairVerdict }) {
  const tone =
    verdict === "agrees"
      ? "bg-success/15 text-success"
      : verdict === "position-flipped"
      ? "bg-danger/10 text-danger"
      : verdict === "disagrees"
      ? "bg-highlight-soft text-highlight-ink"
      : "bg-line/60 text-ink-quiet";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {VERDICT_LABEL[verdict]}
    </span>
  );
}
