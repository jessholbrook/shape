"use client";

import { STANCE_LABEL, type RoundtableReport } from "@/lib/roundtable";
import { MOVE_VERDICT_LABEL, type ReadingReport } from "@/lib/roundtable-judge";
import { StancePill } from "./roundtable-transcript";

/**
 * What the room did. The headline names the phenomenon — the planted seat
 * gave way, the table settled on whoever opened, dissent survived — then
 * each seat's stance round by round, then the checks. Every line is read off
 * the STANCE lines; nothing here asked a model what happened.
 */
export function RoundtableReportPanel({
  report,
  readings,
}: {
  report: RoundtableReport;
  /** The optional judge's readings of the moves, shown beside each seat that moved. */
  readings?: ReadingReport;
}) {
  const rounds = Array.from({ length: report.roundsRun }, (_, i) => i + 1);
  const readingFor = (seatId: string) =>
    readings?.rows.filter((r) => r.move.seatId === seatId && r.verdict !== "incomplete") ?? [];
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          What the room did
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {report.roundsRun} {report.roundsRun === 1 ? "round" : "rounds"}
          {report.stopReason === "consensus" ? " · stopped at consensus" : ""}
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        {report.headline}
      </h2>
      {report.whispers.length > 0 && (
        <p className="font-sans text-[14px] leading-[1.5] text-ink-muted -mt-2">
          {report.whispers.length === 1
            ? "One private note passed under the table"
            : `${report.whispers.length} private notes passed under the table`}
          {report.movedAfterNote.length > 0
            ? `, and ${report.movedAfterNote.map((m) => `${m.seat.name} moved after one from ${m.from.name}`).join("; ")}.`
            : ", and nobody who received one moved afterwards."}{" "}
          You can read them in the transcript; the seats could not.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Seat by seat, round by round
        </p>
        {report.rows.map((r) => (
          <div
            key={r.seat.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2 first:border-t-0 first:pt-0"
          >
            <span className="font-mono text-[11px] text-ink w-[120px] truncate">{r.seat.name}</span>
            {r.seat.plant && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                planted {STANCE_LABEL[r.seat.plant].toLowerCase()}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              {rounds.map((round, i) => (
                <span key={round} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-ink-quiet font-mono text-[10px]">→</span>}
                  <StancePill stance={r.trajectory[i] ?? null} />
                </span>
              ))}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet ml-auto">
              {r.seat.plant
                ? r.held === null
                  ? "unreadable"
                  : r.held
                    ? "held"
                    : `gave way${r.movedAt ? ` in round ${r.movedAt}` : ""}`
                : r.movedAt
                  ? `moved in round ${r.movedAt}`
                  : r.final
                    ? "steady"
                    : ""}
              {readingFor(r.seat.id).length > 0 && (
                <span className="ml-2 text-highlight-ink">
                  · judge: {readingFor(r.seat.id).map((m) => MOVE_VERDICT_LABEL[m.verdict].toLowerCase()).join(", ")}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">Checks</p>
        {report.checks.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line pt-2 first:border-t-0 first:pt-0"
          >
            <span className="font-sans text-[13px] text-ink flex-1 min-w-[200px]">{c.label}</span>
            <span className="font-mono text-[10px] text-ink-quiet">{c.detail}</span>
            <CheckPill result={c.result} />
          </div>
        ))}
      </div>

      <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet border-t border-line pt-4">
        Every check reads the STANCE line each seat ends its turn with — nothing
        asked a model what happened. The experiment is the protocol: move the
        planted seat to speak first, make the first round blind, stop at
        consensus, mix the models. The prompts stay where they are.
      </p>
    </div>
  );
}

function CheckPill({ result }: { result: "held" | "failed" | "na" }) {
  const tone =
    result === "held"
      ? "bg-success/15 text-success"
      : result === "failed"
        ? "bg-danger/10 text-danger"
        : "bg-line/60 text-ink-quiet";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}>
      {result === "held" ? "Held" : result === "failed" ? "Failed" : "n/a"}
    </span>
  );
}
