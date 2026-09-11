"use client";

import { useState } from "react";
import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import type { Writer } from "@/lib/judge";
import { STANCE_LABEL, seatName, type Seat } from "@/lib/roundtable";
import {
  JUDGE_SYSTEM,
  MOVE_VERDICT_BLURB,
  MOVE_VERDICT_LABEL,
  READING_DEFINITION,
  READING_LABEL,
  READING_ORDERS,
  type MoveVerdict,
  type ReadingReport,
} from "@/lib/roundtable-judge";
import { ModelSelect } from "./model-select";
import { InfoTip } from "@/components/info-tip";

/**
 * The judge over the moves. Optional, and never in place of the arithmetic:
 * the checks say that a seat moved and when; this says whether the judge
 * read the move as persuaded or conforming — and only counts a reading that
 * held when the two options were swapped.
 */
export function ReadingPanel({
  seats,
  report,
  judge,
  onJudgeChange,
  hasKey,
  calls,
  costUsd,
  judging,
  disabled,
  onJudge,
}: {
  seats: Seat[];
  report: ReadingReport;
  judge: Writer;
  onJudgeChange: (next: Writer) => void;
  hasKey: boolean;
  calls: number;
  costUsd: number;
  judging: boolean;
  disabled?: boolean;
  onJudge: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const judged = report.read + report.position > 0 || report.rows.some((r) => r.verdict === "unparsed");

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
          A judge over the moves
          <InfoTip>
            The checks can see that a seat moved and when; they can&apos;t see
            why. A judge reads each move — with the table only up to that turn
            — and decides whether the speaker was persuaded or conforming.
            Every move is read twice with the two options swapped; a judge
            that picks the same numbered slot both times is reading position,
            not the turn, and that move is marked unreadable.
          </InfoTip>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {report.moves} {report.moves === 1 ? "move" : "moves"}
        </span>
      </div>

      {report.moves === 0 ? (
        <p className="font-sans text-[14px] leading-[1.55] text-ink-muted">
          Nobody changed position, so there is nothing for a judge to read.
          Every seat held its opening stance — or gave none.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink w-16 shrink-0">
              Judge
            </span>
            <select
              value={judge.provider}
              disabled={disabled || judging}
              onChange={(e) => {
                const next = e.target.value as ProviderId;
                onJudgeChange({ provider: next, model: PROVIDERS[next].defaultModel });
              }}
              aria-label="Judge provider"
              className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
            >
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <ModelSelect
              provider={judge.provider}
              model={judge.model}
              onChange={(model) => onJudgeChange({ ...judge, model })}
              ariaLabel="Judge model"
              className="flex-1 min-w-[180px] bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
            />
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1 w-16 shrink-0 ${
                hasKey ? "text-success" : "text-danger"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-success" : "bg-danger"}`} />
              {hasKey ? "Key" : "No key"}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onJudge}
              disabled={!hasKey || judging || disabled}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {judging ? "Reading…" : judged ? "Read the moves again" : "Read the moves"}
              <span className="text-highlight">→</span>
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {calls} calls — each move read both ways
              {costUsd > 0 ? ` · about $${costUsd < 0.01 ? costUsd.toFixed(4) : costUsd.toFixed(3)}` : ""}
            </span>
          </div>

          {judged && (
            <h2 className="font-display text-[22px] md:text-[26px] leading-[1.15] text-ink">
              <Headline report={report} />
            </h2>
          )}

          <div className="flex flex-col gap-2">
            {report.rows.map((r) => (
              <div
                key={`${r.move.seatId}:${r.move.round}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 first:border-t-0 first:pt-0"
              >
                <span className="font-mono text-[11px] text-ink w-[120px] truncate">
                  {seatName(seats, r.move.seatId)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                  round {r.move.round} · {STANCE_LABEL[r.move.from].toLowerCase()} → {STANCE_LABEL[r.move.to].toLowerCase()}
                </span>
                {r.verdict !== "incomplete" && (
                  <span className="font-mono text-[10px] text-ink-quiet">
                    {READING_ORDERS.map((o) => `${o === "pc" ? "P/C" : "C/P"}: ${r.readings[o] ? READING_LABEL[r.readings[o]!].toLowerCase() : "—"}`).join(" · ")}
                  </span>
                )}
                <span className="ml-auto">
                  <VerdictPill verdict={r.verdict} />
                </span>
              </div>
            ))}
          </div>

          {judged && (
            <div className="border-t border-line pt-4 flex flex-col gap-2">
              {presentVerdicts(report).map((v) => (
                <p key={v} className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
                  <span className="text-ink-muted">{MOVE_VERDICT_LABEL[v]}</span> — {MOVE_VERDICT_BLURB[v]}
                </p>
              ))}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              {showPrompt ? "Hide" : "What the judge is asked"}
            </button>
            {showPrompt && (
              <pre className="mt-2 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[280px] overflow-y-auto text-ink">
                {`${JUDGE_SYSTEM}\n\n— then the proposal, the background, the table up to the move, the move itself, and the two readings, numbered in one order and then the other:\n\n${READING_LABEL.persuaded}: ${READING_DEFINITION.persuaded}\n${READING_LABEL.conforming}: ${READING_DEFINITION.conforming}`}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Headline({ report }: { report: ReadingReport }) {
  if (report.read === 0 && report.position > 0) {
    return (
      <>
        The judge <span className="text-danger">picked a slot</span> on every
        move — it was reading position, not the turns.
      </>
    );
  }
  if (report.read === 0) return <>No reading held.</>;
  const both = report.conforming > 0 && report.persuaded > 0;
  return (
    <>
      The judge read {report.conforming > 0 && (
        <>
          <span className="text-highlight-ink">{report.conforming} {report.conforming === 1 ? "move" : "moves"} as conforming</span>
        </>
      )}
      {both && " and "}
      {report.persuaded > 0 && (
        <>
          <span className="text-success">{report.persuaded} as persuaded</span>
        </>
      )}
      {report.position > 0 && (
        <>
          , and couldn&apos;t be trusted on {report.position}
        </>
      )}
      .
    </>
  );
}

function presentVerdicts(report: ReadingReport): MoveVerdict[] {
  const order: MoveVerdict[] = ["conforming", "persuaded", "position", "unparsed", "incomplete"];
  const present = new Set(report.rows.map((r) => r.verdict));
  return order.filter((v) => present.has(v));
}

export function VerdictPill({ verdict }: { verdict: MoveVerdict }) {
  const tone =
    verdict === "persuaded"
      ? "bg-success/15 text-success"
      : verdict === "conforming"
        ? "bg-highlight-soft text-highlight-ink"
        : verdict === "position"
          ? "bg-danger/10 text-danger"
          : "bg-line/60 text-ink-quiet";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}>
      {MOVE_VERDICT_LABEL[verdict]}
    </span>
  );
}
