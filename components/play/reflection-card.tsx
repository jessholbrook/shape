"use client";

import Link from "next/link";
import type { ReflectionQuestion } from "@/lib/reflection-questions";

/**
 * A quiet, dismissable card that surfaces a guiding question after the user
 * has produced enough material in a playground to reflect on it. Dismissal
 * is owned by the calling playground (component state, not persisted) so
 * the card reappears next visit — these are reading prompts, not chores.
 *
 * When `onAnswerChange` is provided, the card includes a jot-your-answer
 * field. The answer is part of the draft: it saves with the Save-draft bar
 * and shows up in the Notebook and PDF export — turning the reflection into
 * part of the artifact, not a passing thought.
 */
export function ReflectionCard({
  reflection,
  onDismiss,
  answer,
  onAnswerChange,
}: {
  reflection: ReflectionQuestion;
  onDismiss: () => void;
  answer?: string;
  onAnswerChange?: (next: string) => void;
}) {
  return (
    <div className="bg-highlight-soft border border-highlight/40 rounded-[16px] p-5 md:p-6 flex flex-col gap-3 relative">
      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink/80">
          Pause and notice
        </span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss reflection"
          className="shrink-0 -mt-1 -mr-1 w-7 h-7 inline-flex items-center justify-center text-highlight-ink/60 hover:text-highlight-ink rounded-full leading-none text-[18px]"
        >
          ×
        </button>
      </div>
      <p className="font-display text-[20px] md:text-[24px] leading-[1.25] text-ink italic max-w-2xl">
        {reflection.question}
      </p>
      {onAnswerChange && (
        <textarea
          value={answer ?? ""}
          onChange={(e) => onAnswerChange(e.target.value)}
          rows={2}
          placeholder="Jot your answer — it saves with the draft and shows in your Notebook."
          className="w-full bg-canvas/70 border border-highlight/30 rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-highlight focus:outline-none resize-y"
        />
      )}
      <div className="pt-1">
        <Link
          href={reflection.concept.href}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2 hover:text-highlight-ink"
        >
          Read — {reflection.concept.label} →
        </Link>
      </div>
    </div>
  );
}
