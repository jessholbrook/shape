"use client";

import Link from "next/link";
import type { LensId } from "@/lib/lenses";
import { templatesFor } from "@/lib/experiments/templates";

/**
 * The lab's first screen: one choice — a template, something from a
 * playground, or a blank design. The full design
 * form only appears once there's something to design.
 */
export function LabStart({
  lens,
  onPickTemplate,
  onBlank,
}: {
  lens: LensId | null;
  onPickTemplate: (id: string) => void;
  onBlank: () => void;
}) {
  const list = templatesFor(lens);
  return (
    <div className="flex flex-col gap-10" data-testid="lab-start">
      <section aria-label="Start an experiment" className="flex flex-col gap-6">
        <h2 className="font-display text-[28px] md:text-[34px] leading-[1.1] tracking-tight text-ink">
          Start from a common question or <span className="italic">write your own</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* The ready-made studies, as their own group; the two other ways in share the grid. */}
          <div className="contents" role="group" aria-label="Templates">
            {list.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onPickTemplate(t.id)}
                className="text-left rounded-[12px] border border-line bg-surface p-4 transition-colors hover:border-ink/50"
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
            ))}
          </div>
          <Link
            href="/play"
            className="block rounded-[12px] border border-line bg-canvas/40 p-4 transition-colors hover:border-ink/50"
          >
            <span className="font-display text-[17px] leading-[1.25] text-ink">Bring something from Play →</span>
            <span className="block font-sans text-[13px] leading-[1.5] text-ink-muted mt-1.5">
              Saw something odd in a playground? Every playground has <span className="text-ink">Open as experiment</span>, which
              brings its setup here to test properly.
            </span>
          </Link>
          <button
            type="button"
            onClick={onBlank}
            className="text-left rounded-[12px] border border-line bg-canvas/40 p-4 transition-colors hover:border-ink/50"
          >
            <span className="font-display text-[17px] leading-[1.25] text-ink">Start from scratch</span>
            <span className="block font-sans text-[13px] leading-[1.5] text-ink-muted mt-1.5">
              Your own question: write it down, make two versions of a prompt, and decide how to score the answers.
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}
