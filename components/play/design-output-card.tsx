"use client";

import {
  SCORE_MAX,
  designTotal,
  type Criterion,
  type DesignOutput,
  type Score,
} from "@/lib/evals";
import { CriterionScoreRow } from "./eval-case-row";

/**
 * One fixed output, scored by hand against the rubric under design. The
 * truth — where a careful reader ranks it, and why — stays hidden until the
 * reader has committed to scores, the same reason a rubric is written before
 * the scoring: a judgement made after seeing the answer isn't a judgement.
 *
 * For a generated set the truth is the reader's own ranking, given through
 * the `rank` control before any scoring; the card then shows it as theirs.
 */
export type RankControl = {
  value: number | null;
  /** How many outputs there are to rank. */
  count: number;
  /** Ranks lock once scoring starts — the reason is shown in place of the control. */
  locked: boolean;
  onChange: (rank: number | null) => void;
};

export function DesignOutputCard({
  output,
  criteria,
  scores,
  note,
  revealed,
  onScore,
  onNoteChange,
  rank,
  truthLabel = "A careful reader",
  scoringLocked,
  notePlaceholder = "What you'd want a criterion to catch here…",
}: {
  output: DesignOutput;
  criteria: Criterion[];
  scores: Record<string, Score | null>;
  note: string;
  revealed: boolean;
  onScore: (criterionId: string, score: Score | null) => void;
  onNoteChange: (note: string) => void;
  /** Present for generated sets: the reader ranks before scoring. */
  rank?: RankControl;
  /** Who the truth belongs to — "A careful reader" for seeded sets, "Your ranking" for generated. */
  truthLabel?: string;
  /** When set, the score rows are disabled and this line says why. */
  scoringLocked?: string;
  notePlaceholder?: string;
}) {
  const total = designTotal(criteria, scores);
  const scored = criteria.filter((c) => typeof scores[c.id] === "number").length;
  const ordinal = ordinalOf(output.truthRank);

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-display text-[16px] leading-[1.2] text-ink">
            {output.label}
          </span>
          {revealed && output.truthRank > 0 && (
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 ${
                output.truthRank === 1
                  ? "bg-success/15 text-success"
                  : "bg-highlight-soft text-highlight-ink"
              }`}
            >
              {truthLabel}: {ordinal}
            </span>
          )}
          {rank && !revealed && (
            <label className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Your rank
              <select
                value={rank.value ?? ""}
                disabled={rank.locked}
                onChange={(e) => rank.onChange(e.target.value === "" ? null : Number(e.target.value))}
                aria-label={`${output.label}: your rank`}
                title={rank.locked ? "Ranks lock once you start scoring. Reset to change them." : undefined}
                className="bg-canvas border border-line rounded-[8px] px-2 py-1 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
              >
                <option value="">—</option>
                {Array.from({ length: rank.count }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>
                    {ordinalOf(r)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
          {total === null ? (
            <span className="text-ink-quiet">
              {scored}/{criteria.length} scored
            </span>
          ) : (
            <>
              <span className="text-ink">{total}</span>
              <span className="text-ink-quiet">/{criteria.length * SCORE_MAX}</span>
            </>
          )}
        </span>
      </div>

      <p className="mt-4 font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words">
        {output.text}
      </p>

      {revealed && output.why && output.why !== note.trim() && (
        <p className="mt-3 font-sans text-[13px] leading-[1.55] text-ink-muted border-l-2 border-highlight pl-3">
          {output.why}
        </p>
      )}

      <div className="mt-4 pt-4 border-t border-line flex flex-col gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Score against your rubric
          {scoringLocked && (
            <span className="ml-2 normal-case tracking-normal text-highlight-ink">
              {scoringLocked}
            </span>
          )}
        </p>
        {criteria.map((c) => (
          <CriterionScoreRow
            key={c.id}
            criterion={c}
            score={scores[c.id] ?? null}
            disabled={!!scoringLocked}
            onScore={(s) => onScore(c.id, s)}
          />
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-line">
        <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet block mb-1">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={1}
          placeholder={notePlaceholder}
          className="w-full bg-canvas border border-line rounded-[8px] px-3 py-2 font-sans text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
      </div>
    </div>
  );
}

function ordinalOf(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th", "6th"][n - 1] ?? `${n}th`;
}
