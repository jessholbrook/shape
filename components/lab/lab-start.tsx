"use client";

import Link from "next/link";
import type { LensId } from "@/lib/lenses";
import { templatesFor } from "@/lib/experiments/templates";
import { EYEBROW, PANEL } from "./fields";

/**
 * The lab's first screen: what a result looks like, then one choice — a
 * template, something from a playground, or a blank design. The full design
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
      <ExampleResult />

      <section aria-label="Start an experiment" className="flex flex-col gap-6">
        <h2 className="font-display text-[28px] md:text-[34px] leading-[1.1] tracking-tight text-ink">
          Start an <span className="italic">experiment</span>.
        </h2>

        <div className="flex flex-col gap-3">
          <p className={EYEBROW}>From a ready-made study</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="group" aria-label="Templates">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

/**
 * What a finished experiment gives you, before you build one. The numbers
 * are illustrative and labelled as such; they're internally consistent
 * (90 answers per version, 95% intervals) so the picture isn't misleading.
 */
function ExampleResult() {
  const rows = [
    { label: "Asked neutrally", rate: 41, lo: 31, hi: 51 },
    { label: "User says they favor it", rate: 63, lo: 53, hi: 73 },
  ];
  return (
    <section className={PANEL} aria-label="Example result" data-testid="lab-example">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={EYEBROW}>What you get · an example</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">Illustrative numbers</p>
      </div>
      <p className="font-display text-[20px] md:text-[22px] leading-[1.3] text-ink">
        Does the model side with the user?
      </p>
      <p className="font-sans text-[13px] text-ink-muted -mt-2">How often each version&apos;s answer endorses the idea, out of 90 answers each.</p>

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_auto] sm:grid-cols-[12rem_1fr_auto] items-center gap-x-3 gap-y-1">
            <span className="col-span-2 sm:col-span-1 font-sans text-[13px] text-ink truncate">{r.label}</span>
            <div className="relative h-3 rounded-full bg-line/60" aria-hidden>
              <div className="absolute inset-y-0 left-0 rounded-full bg-ink/80" style={{ width: `${r.rate}%` }} />
              {/* 95% interval */}
              <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-highlight" style={{ left: `${r.lo}%`, width: `${r.hi - r.lo}%` }} />
              <div className="absolute top-0 bottom-0 w-[2px] bg-highlight" style={{ left: `${r.lo}%` }} />
              <div className="absolute top-0 bottom-0 w-[2px] bg-highlight" style={{ left: `${r.hi}%` }} />
            </div>
            <span className="font-mono text-[12px] text-ink tabular-nums">
              {r.rate}% <span className="text-ink-quiet">±10</span>
            </span>
          </div>
        ))}
      </div>

      <p className="font-sans text-[14px] leading-[1.55] text-ink">
        <span className="font-medium">Clear difference:</span> 22 points more endorsement when the user says what they think
        (likely somewhere between 8 and 36).
      </p>
      <p className="font-sans text-[13px] leading-[1.55] text-ink-muted border-t border-line pt-3">
        In Play you&apos;d see one answer from each version and have to guess. Here each version ran 30 times on each of 3
        topics, and the result comes with a record of every prompt and answer, so anyone can check it or run it again.
      </p>
    </section>
  );
}
