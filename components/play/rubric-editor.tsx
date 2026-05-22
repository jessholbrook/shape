"use client";

import { newCriterionId, type Criterion } from "@/lib/evals";

const MAX_CRITERIA = 8;
const MIN_CRITERIA = 1;

export function RubricEditor({
  criteria,
  onChange,
}: {
  criteria: Criterion[];
  onChange: (next: Criterion[]) => void;
}) {
  function updateCriterion(id: string, patch: Partial<Criterion>) {
    onChange(criteria.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function removeCriterion(id: string) {
    if (criteria.length <= MIN_CRITERIA) return;
    onChange(criteria.filter((c) => c.id !== id));
  }

  function addCriterion() {
    if (criteria.length >= MAX_CRITERIA) return;
    onChange([
      ...criteria,
      {
        id: newCriterionId(),
        name: "New criterion",
        description: "",
      },
    ]);
  }

  const canAdd = criteria.length < MAX_CRITERIA;
  const canRemove = criteria.length > MIN_CRITERIA;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Rubric — {criteria.length}{" "}
          {criteria.length === 1 ? "criterion" : "criteria"}
        </div>
        <button
          type="button"
          onClick={addCriterion}
          disabled={!canAdd}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2 disabled:opacity-40 disabled:no-underline disabled:text-ink-quiet"
        >
          + Add criterion
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {criteria.map((c, i) => (
          <div
            key={c.id}
            className="bg-canvas border border-line rounded-[12px] p-4"
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => removeCriterion(c.id)}
                disabled={!canRemove}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger disabled:opacity-30 disabled:hover:text-ink-quiet"
              >
                Remove
              </button>
            </div>
            <input
              type="text"
              value={c.name}
              onChange={(e) => updateCriterion(c.id, { name: e.target.value })}
              placeholder="Criterion name"
              className="w-full bg-transparent border-0 border-b border-line px-0 py-1 font-display text-[18px] leading-[1.2] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
            />
            <textarea
              value={c.description}
              onChange={(e) =>
                updateCriterion(c.id, { description: e.target.value })
              }
              rows={2}
              placeholder="What does this measure? One line."
              className="mt-2 w-full bg-transparent border-0 px-0 font-mono text-[12px] leading-[1.55] text-ink-muted placeholder:text-ink-quiet focus:outline-none resize-y"
            />
          </div>
        ))}
      </div>

      {!canAdd && (
        <p className="font-mono text-[10px] text-ink-quiet">
          Max {MAX_CRITERIA} criteria. Remove one to add another.
        </p>
      )}
    </div>
  );
}
