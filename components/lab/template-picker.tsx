"use client";

import type { LensId } from "@/lib/lenses";
import { templatesFor } from "@/lib/experiments/templates";
import { EYEBROW } from "./fields";

/**
 * "Start from" — the template library, the reader's own first. Picking one
 * replaces the experiment, so the caller confirms when there's work to lose.
 */
export function TemplatePicker({
  lens,
  activeId,
  onPick,
}: {
  lens: LensId | null;
  activeId: string | null;
  onPick: (id: string) => void;
}) {
  const list = templatesFor(lens);
  return (
    <section aria-label="Start from a template" className="flex flex-col gap-3">
      <p className={EYEBROW}>Start from</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="group" aria-label="Templates">
        {list.map((t, i) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPick(t.id)}
              className={`text-left rounded-[12px] border p-4 transition-colors ${
                active ? "border-ink bg-surface" : "border-line bg-canvas/40 hover:border-ink/50"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-[17px] leading-[1.25] text-ink">{t.title}</span>
                {i === 0 && lens && (
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
                    for you
                  </span>
                )}
              </span>
              <span className="block font-sans text-[13px] leading-[1.5] text-ink-muted mt-1.5">{t.blurb}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
