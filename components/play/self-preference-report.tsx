"use client";

import {
  SELF_BLURB,
  SELF_LABEL,
  type SelfReport,
  type SelfVerdict,
} from "@/lib/judge";

/**
 * Two writers, two judges, one question: does a model rate its own writing
 * higher? The headline counts pairs where each judge picked its own answer,
 * stable across the swap — the case where nothing changed between the two
 * verdicts except who was asking.
 */
export function SelfPreferenceReportPanel({
  report,
  names,
}: {
  report: SelfReport;
  names: { a: string; b: string };
}) {
  if (report.scored === 0) return null;
  const n = report.scored;
  const noun = n === 1 ? "pair" : "pairs";

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Self-preference
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {n} {noun}, two judges, both ways
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        {report.eachOwn > 0 ? (
          <>
            Each model{" "}
            <span className="text-danger">preferred its own answer</span> on{" "}
            {report.eachOwn} of {n} {noun}.
          </>
        ) : report.flipped > 0 && report.agreed < n ? (
          <>
            A judge <span className="text-highlight-ink">flipped when swapped</span>{" "}
            on {report.flipped} of {n} {noun} — position, before preference.
          </>
        ) : report.agreed === n ? (
          <>
            Both judges{" "}
            <span className="text-success">agreed on every pair</span>. No sign
            of self-preference here.
          </>
        ) : (
          <>The judges agreed on {report.agreed} of {n} {noun}; read the rest.</>
        )}
      </h2>

      <div className="flex flex-col gap-2.5">
        {report.rows.map((row) => (
          <div
            key={row.pair.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink flex-1 min-w-[140px]">
              {row.pair.label}
            </span>
            {row.verdict !== "incomplete" && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet whitespace-nowrap">
                {names.a} judge: {pickLabel(row.judgeA)} · {names.b} judge:{" "}
                {pickLabel(row.judgeB)}
              </span>
            )}
            <SelfPill verdict={row.verdict} />
          </div>
        ))}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {presentVerdicts(report).map((v) => (
          <p key={v} className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
            <span className="text-ink-muted">{SELF_LABEL[v]}</span> —{" "}
            {SELF_BLURB[v]}
          </p>
        ))}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
          Each pair costs six calls: two answers, then each writer judges both
          orders. The swap is still there — a judge that flips on position
          can&apos;t be read for preference.
        </p>
      </div>
    </div>
  );
}

function pickLabel(row: { verdict: string; pickAB: string }): string {
  if (row.verdict === "agrees" || row.verdict === "disagrees") {
    return row.pickAB.toUpperCase();
  }
  if (row.verdict === "position-flipped") return "flipped";
  if (row.verdict === "tie") return "tie";
  return "—";
}

function presentVerdicts(report: SelfReport): SelfVerdict[] {
  const order: SelfVerdict[] = ["each-own", "each-other", "agreed", "flipped", "tie", "unparsed", "incomplete"];
  const present = new Set(report.rows.map((r) => r.verdict));
  return order.filter((v) => present.has(v));
}

function SelfPill({ verdict }: { verdict: SelfVerdict }) {
  const tone =
    verdict === "agreed"
      ? "bg-success/15 text-success"
      : verdict === "each-own"
        ? "bg-danger/10 text-danger"
        : verdict === "each-other" || verdict === "flipped"
          ? "bg-highlight-soft text-highlight-ink"
          : "bg-line/60 text-ink-quiet";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {SELF_LABEL[verdict]}
    </span>
  );
}
