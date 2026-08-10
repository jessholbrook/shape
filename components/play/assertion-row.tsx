"use client";

import {
  ASSERTION_KIND_LABELS,
  type Assertion,
  type AssertionKind,
} from "@/lib/spread";

const KINDS: AssertionKind[] = [
  "contains",
  "excludes",
  "maxWords",
  "minWords",
];

/**
 * One editable claim about what the spec should guarantee. Deliberately
 * plain-language — a designer writes "excludes !" rather than a regex — and
 * deliberately deterministic, so scoring a run costs nothing.
 */
export function AssertionRow({
  assertion,
  onChange,
  onRemove,
  canRemove,
}: {
  assertion: Assertion;
  onChange: (next: Assertion) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const numeric =
    assertion.kind === "maxWords" || assertion.kind === "minWords";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={assertion.kind}
        onChange={(e) =>
          onChange({ ...assertion, kind: e.target.value as AssertionKind })
        }
        aria-label="Assertion type"
        className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
      >
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {ASSERTION_KIND_LABELS[k]}
          </option>
        ))}
      </select>

      <input
        type={numeric ? "number" : "text"}
        min={numeric ? 1 : undefined}
        value={assertion.value}
        onChange={(e) => onChange({ ...assertion, value: e.target.value })}
        placeholder={numeric ? "30" : "a word or phrase"}
        aria-label="Assertion value"
        className={`bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none ${
          numeric ? "w-24" : "flex-1 min-w-[160px]"
        }`}
      />

      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Remove assertion"
        className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-[18px] leading-none text-ink-quiet hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ×
      </button>
    </div>
  );
}
