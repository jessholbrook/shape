"use client";

import { assertionLabel } from "@/lib/spread";
import {
  PORTABILITY_BLURB,
  PORTABILITY_LABEL,
  modelLabel,
  type ModelRef,
  type Portability,
  type PortabilityReport,
} from "@/lib/portability";

/**
 * Clauses down the side, models across the top. The matrix is the artifact:
 * a row that's green all the way across is a rule, and a row that's green in
 * one column is a vendor habit you wrote down as if it were one.
 */
export function PortabilityMatrix({
  report,
  refs,
}: {
  report: PortabilityReport;
  refs: ModelRef[];
}) {
  if (report.total === 0 || report.modelsScored === 0) return null;

  const allPortable = report.portable === report.total;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Portability report
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          across {report.modelsScored} model
          {report.modelsScored === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        <span className={allPortable ? "text-success" : "text-ink"}>
          {report.portable} of {report.total}
        </span>{" "}
        {report.total === 1 ? "clause is" : "clauses are"} portable.
      </h2>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet pb-2 pr-4 font-normal">
                Clause
              </th>
              {refs.map((ref) => (
                <th
                  key={ref.id}
                  className="text-center font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet pb-2 px-2 font-normal whitespace-nowrap"
                >
                  {modelLabel(ref)}
                </th>
              ))}
              <th className="text-right font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet pb-2 pl-4 font-normal">
                Verdict
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.assertion.id} className="border-t border-line">
                <td className="font-mono text-[11px] text-ink py-3 pr-4 align-middle">
                  {assertionLabel(row.assertion)}
                </td>
                {row.cells.map((cell) => (
                  <td key={cell.refId} className="text-center px-2 py-3">
                    <CellMark hits={cell.hits} total={cell.total} />
                  </td>
                ))}
                <td className="text-right pl-4 py-3 whitespace-nowrap">
                  <VerdictPill verdict={row.verdict} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {orderedVerdicts(report).map((v) => (
          <p
            key={v}
            className="font-mono text-[10px] leading-[1.6] text-ink-quiet"
          >
            <span className="text-ink-muted">{PORTABILITY_LABEL[v]}</span> —{" "}
            {PORTABILITY_BLURB[v]}
          </p>
        ))}
        {report.singleSample && (
          <p className="font-mono text-[10px] leading-[1.6] text-danger mt-1">
            One run per model. At a single sample a clause that&apos;s simply
            unreliable looks identical to one that&apos;s model-specific —
            raise runs per model to three before trusting these labels.
          </p>
        )}
      </div>
    </div>
  );
}

/** Only explain the verdicts actually on screen. */
function orderedVerdicts(report: PortabilityReport): Portability[] {
  const order: Portability[] = [
    "portable",
    "model-specific",
    "unstable",
    "absent",
    "unknown",
  ];
  const present = new Set(report.rows.map((r) => r.verdict));
  return order.filter((v) => present.has(v));
}

function CellMark({ hits, total }: { hits: number; total: number }) {
  if (total === 0) {
    return <span className="font-mono text-[12px] text-ink-quiet">—</span>;
  }
  const all = hits === total;
  const none = hits === 0;
  return (
    <span
      className={`font-mono text-[12px] tabular-nums ${
        all ? "text-success" : none ? "text-danger" : "text-ink"
      }`}
      title={`${hits} of ${total} runs passed`}
    >
      {total === 1 ? (all ? "✓" : "✕") : `${hits}/${total}`}
    </span>
  );
}

function VerdictPill({ verdict }: { verdict: Portability }) {
  const tone =
    verdict === "portable"
      ? "bg-success/15 text-success"
      : verdict === "model-specific"
      ? "bg-highlight-soft text-highlight-ink"
      : verdict === "absent"
      ? "bg-danger/10 text-danger"
      : "bg-line/60 text-ink-quiet";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 ${tone}`}
    >
      {PORTABILITY_LABEL[verdict]}
    </span>
  );
}
