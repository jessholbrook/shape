"use client";

import {
  SCORE_LABELS,
  SCORE_MAX,
  SCORE_MIN,
  caseScore,
  type CaseResult,
  type Criterion,
  type EvalCase,
  type Score,
} from "@/lib/evals";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";

export function EvalCaseRow({
  num,
  evalCase,
  criteria,
  result,
  onScore,
  onNoteChange,
}: {
  num: number;
  evalCase: EvalCase;
  criteria: Criterion[];
  result: CaseResult;
  onScore: (criterionId: string, score: Score | null) => void;
  onNoteChange: (note: string) => void;
}) {
  const elapsed =
    result.startMs && result.endMs
      ? ((result.endMs - result.startMs) / 1000).toFixed(1) + "s"
      : null;
  const score = caseScore(criteria, result);

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            Case {num}
          </span>
          <span className="font-display text-[16px] leading-[1.2] text-ink truncate">
            {evalCase.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusDot status={result.status} />
          {score && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
              <span className="text-ink">{score.total}</span>
              <span className="text-ink-quiet">/{score.max}</span>
              {score.scored < criteria.length && (
                <span className="text-ink-quiet ml-2">
                  ({score.scored}/{criteria.length})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* User message */}
      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          User message
        </p>
        <p className="font-sans text-[14px] leading-[1.55] text-ink italic">
          &ldquo;{evalCase.userMessage}&rdquo;
        </p>
      </div>

      {/* Output */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Output
          </p>
          {result.status === "done" && !!result.output && (
            <div className="flex items-center gap-3">
              <ShareActions
                copyText={result.output}
                filenameStem={`eval-case${num}`}
                markdown={[
                  `# Eval Lab — case ${num}: ${evalCase.label}`,
                  "",
                  ...(score
                    ? [`**Score:** ${score.total}/${score.max}`, ""]
                    : []),
                  "## User message",
                  "",
                  evalCase.userMessage,
                  "",
                  "## Output",
                  "",
                  result.output,
                  "",
                  ...(result.note?.trim()
                    ? ["## Reviewer note", "", result.note.trim(), ""]
                    : []),
                ].join("\n")}
              />
            </div>
          )}
        </div>
        <div className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[60px]">
          {result.error ? (
            <span className="text-danger">{result.error}</span>
          ) : result.output ? (
            <>
              {result.output}
              {result.status === "running" && (
                <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
              )}
            </>
          ) : result.status === "running" ? (
            <StreamingPlaceholder />
          ) : (
            <span className="text-ink-quiet italic">Not run yet.</span>
          )}
        </div>
        {(result.status === "done" || result.status === "error") &&
          (result.inputTokens || result.outputTokens || elapsed) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {result.inputTokens != null && (
                <span>in {result.inputTokens} tok</span>
              )}
              {result.outputTokens != null && (
                <span>out {result.outputTokens} tok</span>
              )}
              {result.costUsd != null && (
                <span className="text-ink">
                  {result.costUsd < 0.01
                    ? "<$0.01"
                    : `$${result.costUsd.toFixed(3)}`}
                </span>
              )}
              {elapsed && <span>{elapsed}</span>}
            </div>
          )}
      </div>

      {/* Score grid */}
      <div className="mt-4 pt-4 border-t border-line flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Score against rubric
        </p>
        {criteria.map((c) => (
          <CriterionScoreRow
            key={c.id}
            criterion={c}
            score={result.scores[c.id] ?? null}
            disabled={result.status === "idle"}
            onScore={(s) => onScore(c.id, s)}
          />
        ))}
      </div>

      {/* Note */}
      <div className="mt-4 pt-4 border-t border-line">
        <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet block mb-1">
          Reviewer note (optional)
        </label>
        <textarea
          value={result.note ?? ""}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={1}
          placeholder="What stood out — and what tanked the score?"
          className="w-full bg-canvas border border-line rounded-[8px] px-3 py-2 font-sans text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
      </div>
    </div>
  );
}

function CriterionScoreRow({
  criterion,
  score,
  disabled,
  onScore,
}: {
  criterion: Criterion;
  score: Score | null;
  disabled: boolean;
  onScore: (next: Score | null) => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
      <div className="md:flex-1 min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          {criterion.name}
        </p>
        {criterion.description && (
          <p className="font-mono text-[10px] leading-[1.5] text-ink-quiet mt-0.5">
            {criterion.description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }).map((_, i) => {
          const value = (SCORE_MIN + i) as Score;
          const active = score === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onScore(active ? null : value)}
              disabled={disabled}
              title={SCORE_LABELS[value]}
              aria-label={`${criterion.name}: ${SCORE_LABELS[value]}`}
              className={`w-8 h-8 rounded-full font-mono text-[12px] border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                active
                  ? "bg-ink text-canvas border-ink"
                  : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: CaseResult["status"] }) {
  if (status === "idle") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Idle
      </span>
    );
  }
  const color =
    status === "running"
      ? "bg-highlight animate-pulse"
      : status === "done"
      ? "bg-success"
      : "bg-danger";
  const label =
    status === "running" ? "Streaming" : status === "done" ? "Done" : "Error";
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
