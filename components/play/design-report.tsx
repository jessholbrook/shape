"use client";

import {
  CRITERION_VERDICT_BLURB,
  CRITERION_VERDICT_LABEL,
  type CriterionVerdict,
  type DesignReport,
} from "@/lib/evals";

/**
 * Does the rubric rank the outputs the way a careful reader does? The
 * headline is the pair count — every pair of outputs, ordered the same way
 * or not — and under it, each criterion is diagnosed on its own: the ones
 * doing the separating, the ones scoring everything alike, and the ones
 * pulling the wrong way. The last group is the lesson: a criterion that
 * sounds right and rewards the wrong output.
 */
export type TruthVoice = {
  /** Badge label on each output, e.g. "A careful reader" or "Your ranking". */
  label: string;
  /** Completes "ordered N pairs the way …". */
  phrase: string;
  /** The closing note on whose ranking this is, or null to omit it. */
  footnote: string | null;
};

export const CAREFUL_READER: TruthVoice = {
  label: "A careful reader",
  phrase: "a careful reader does",
  footnote:
    "“A careful reader” is our ranking, with its reasons on each output. Disagree with it — that is allowed, and it is the conversation a real rubric review is made of. The point is that the total only means something if the criteria under it separate the outputs on purpose.",
};

export const YOUR_RANKING: TruthVoice = {
  label: "Your ranking",
  phrase: "you did",
  footnote: null,
};

export function DesignReportPanel({
  report,
  lesson,
  truth = CAREFUL_READER,
}: {
  report: DesignReport;
  /** The set's own reading of its trap, shown once the truth is out. */
  lesson?: string;
  /** Whose ranking the rubric is checked against. */
  truth?: TruthVoice;
}) {
  const { tally } = report;
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Does the rubric separate them?
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {tally.pairs} pairs
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        {!report.fullyScored || tally.pairs === 0 ? (
          <>
            Score every output on every criterion to see whether the rubric
            separates them.
          </>
        ) : tally.concordant === tally.pairs ? (
          <>
            Your rubric ordered{" "}
            <span className="text-success">every pair</span> the way {truth.phrase}.
          </>
        ) : tally.discordant > tally.concordant ? (
          <>
            Your rubric ordered{" "}
            <span className="text-danger">
              {tally.discordant} of {tally.pairs} pairs the wrong way
            </span>
            . It is measuring something — not this.
          </>
        ) : (
          <>
            Your rubric ordered{" "}
            <span className="text-highlight-ink">
              {tally.concordant} of {tally.pairs} pairs
            </span>{" "}
            the way {truth.phrase}
            {tally.ties > 0 && (
              <>
                , and couldn&apos;t tell {tally.ties}{" "}
                {tally.ties === 1 ? "pair" : "pairs"} apart
              </>
            )}
            .
          </>
        )}
      </h2>

      {lesson && report.fullyScored && tally.pairs > 0 && (
        <p className="font-sans text-[14px] leading-[1.55] text-ink-muted border-l-2 border-highlight pl-3">
          {lesson}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          By your totals
        </p>
        {report.ranked.map((r) => (
          <div
            key={r.output.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink w-[80px]">
              {r.output.label}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-ink-muted w-[64px]">
              {r.total === null ? "—" : `${r.total}/${r.max}`}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              yours: {r.rubricRank === null ? "—" : ordinal(r.rubricRank)}
            </span>
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 ${
                r.rubricRank === r.output.truthRank
                  ? "bg-success/15 text-success"
                  : "bg-highlight-soft text-highlight-ink"
              }`}
            >
              {truth.label.toLowerCase()}: {ordinal(r.output.truthRank)}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Criterion by criterion
        </p>
        {report.criteria.map((d) => (
          <div
            key={d.criterion.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink flex-1 min-w-[140px]">
              {d.criterion.name || "Untitled criterion"}
            </span>
            {d.verdict !== "unscored" && (
              <span className="font-mono text-[10px] tabular-nums text-ink-quiet">
                spread {d.spread} · {d.tally.concordant}✓ {d.tally.discordant}✗{" "}
                {d.tally.ties}=
              </span>
            )}
            <VerdictPill verdict={d.verdict} />
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {presentVerdicts(report).map((v) => (
          <p key={v} className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
            <span className="text-ink-muted">{CRITERION_VERDICT_LABEL[v]}</span> —{" "}
            {CRITERION_VERDICT_BLURB[v]}
          </p>
        ))}
        {truth.footnote && (
          <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
            {truth.footnote}
          </p>
        )}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th", "6th"][n - 1] ?? `${n}th`;
}

function presentVerdicts(report: DesignReport): CriterionVerdict[] {
  const order: CriterionVerdict[] = ["crowns-wrong", "inverted", "flat", "mixed", "separating", "unscored"];
  const present = new Set(report.criteria.map((d) => d.verdict));
  return order.filter((v) => present.has(v));
}

function VerdictPill({ verdict }: { verdict: CriterionVerdict }) {
  const tone =
    verdict === "separating"
      ? "bg-success/15 text-success"
      : verdict === "inverted" || verdict === "crowns-wrong"
        ? "bg-danger/10 text-danger"
        : verdict === "unscored"
          ? "bg-line/60 text-ink-quiet"
          : "bg-highlight-soft text-highlight-ink";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {CRITERION_VERDICT_LABEL[verdict]}
    </span>
  );
}
