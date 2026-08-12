"use client";

import type { Pair } from "@/lib/judge";
import { InfoTip } from "@/components/info-tip";

/**
 * One comparison, and your own call on it.
 *
 * The human pick is set here rather than in the report for the same reason a
 * rubric gets written before the scoring: a judgement made after seeing the
 * machine's answer isn't ground truth, it's agreement.
 */
export function PairEditor({
  pair,
  onChange,
  onRemove,
  canRemove,
}: {
  pair: Pair;
  onChange: (next: Pair) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="bg-canvas border border-line rounded-[12px] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={pair.label}
          onChange={(e) => onChange({ ...pair, label: e.target.value })}
          placeholder="Pair name"
          aria-label="Pair name"
          className="flex-1 min-w-[120px] bg-surface border border-line rounded-[8px] px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${pair.label || "pair"}`}
          className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-[18px] leading-none text-ink-quiet hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          The request
        </span>
        <textarea
          value={pair.prompt}
          onChange={(e) => onChange({ ...pair, prompt: e.target.value })}
          rows={2}
          aria-label="Request"
          className="w-full bg-surface border border-line rounded-[8px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
        />
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CandidateField
          label="Answer A"
          value={pair.a}
          onChange={(a) => onChange({ ...pair, a })}
        />
        <CandidateField
          label="Answer B"
          value={pair.b}
          onChange={(b) => onChange({ ...pair, b })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
          Your pick
          <InfoTip>
            Decide before you run the judge. A call made after seeing the
            machine&apos;s answer isn&apos;t ground truth — it&apos;s
            agreement.
          </InfoTip>
        </span>
        {(["a", "b"] as const).map((side) => (
          <button
            key={side}
            type="button"
            onClick={() =>
              onChange({
                ...pair,
                humanPick: pair.humanPick === side ? null : side,
              })
            }
            className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-[8px] px-3 py-1.5 border transition-colors ${
              pair.humanPick === side
                ? "bg-ink text-canvas border-ink"
                : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
            }`}
          >
            {pair.humanPick === side ? "✓ " : ""}
            {side.toUpperCase()}
          </button>
        ))}
        {pair.humanPick === null && (
          <span className="font-mono text-[10px] text-ink-quiet">
            no pick — nothing to compare the judge against
          </span>
        )}
      </div>
    </div>
  );
}

function CandidateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label} · {words} words
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        aria-label={label}
        className="w-full bg-surface border border-line rounded-[8px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
      />
    </label>
  );
}
