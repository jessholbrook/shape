"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LENSES, type LensId } from "@/lib/lenses";
import { templatesFor, type ExperimentTemplate } from "@/lib/experiments/templates";

/**
 * The lab's first screen: one choice — a template, something from a
 * playground, or a blank design. The full design form only appears once
 * there's something to design. Cards share the home page's card style, each
 * with a small looping preview of what it does.
 */

const CARD =
  "group text-left flex flex-col bg-surface border border-line rounded-[16px] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-ink/30 transition";
const PREVIEW = "relative h-[88px] rounded-[12px] bg-canvas border border-line p-3 overflow-hidden";
const KICKER = "font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet";
const FOOTER = "mt-auto pt-4";
const FOOTER_LINE = "pt-4 border-t border-line font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet";

function useTick(period: number, ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % period), ms);
    return () => clearInterval(id);
  }, [period, ms]);
  return tick;
}

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* The ready-made studies, as their own group; the two other ways in share the grid. */}
          <div className="contents" role="group" aria-label="Templates">
            {list.map((t, i) => (
              <TemplateCard key={t.id} template={t} forYou={i === 0 && !!lens} onPick={() => onPickTemplate(t.id)} />
            ))}
          </div>

          <Link href="/play" className={CARD}>
            <div className="flex items-center justify-between">
              <span className={KICKER}>From Play</span>
              <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">Browse →</span>
            </div>
            <h3 className="font-display text-[24px] leading-[1.15] tracking-tight text-ink mt-4">
              Bring something from <span className="italic">Play</span>
            </h3>
            <div className="mt-4">
              <FromPlayPreview />
            </div>
            <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">
              Saw something odd in a playground? Every playground has <span className="text-ink">Open as experiment</span>, which
              brings its setup here to test properly.
            </p>
          </Link>

          <button type="button" onClick={onBlank} className={`${CARD} lg:col-span-2`}>
            <div className="flex items-center justify-between w-full">
              <span className={KICKER}>Your own</span>
              <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">Start →</span>
            </div>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,1.2fr)] gap-x-8 gap-y-4 items-center w-full">
              <div>
                <h3 className="font-display text-[24px] leading-[1.15] tracking-tight text-ink">
                  Start from <span className="italic">scratch</span>
                </h3>
                <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">
                  Your own question: write it down, make two versions of a prompt, and decide how to score the answers.
                </p>
              </div>
              <ScratchPreview />
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}

function TemplateCard({ template, forYou, onPick }: { template: ExperimentTemplate; forYou: boolean; onPick: () => void }) {
  // Built once against a placeholder model: only labels are read.
  const [design] = useState(() => template.build({ provider: "shape-free", model: "preview" }, 0));
  const [a, b] = design.conditions;
  const measure = design.measures[0]?.label ?? "the answers";
  const lens = template.lenses[0];
  return (
    <button type="button" onClick={onPick} className={CARD}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {lens && <span className={KICKER}>{LENSES[lens].short}</span>}
          {forYou && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
              for you
            </span>
          )}
        </span>
        <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">Start →</span>
      </div>
      <h3 className="font-display text-[24px] leading-[1.15] tracking-tight text-ink mt-4">{template.title}</h3>
      <div className="mt-4">
        <CompareBars a={a?.label ?? "Baseline"} b={b?.label ?? "Changed"} measure={measure} seed={template.id.length} />
      </div>
      <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">{template.blurb}</p>
      <div className={FOOTER}>
        <div className={FOOTER_LINE}>
          {design.table
            ? `${design.conditions.length} versions · ${design.table.seats.length} agents · ${design.measures.length} ${design.measures.length === 1 ? "check" : "checks"}`
            : `${design.conditions.length} versions · ${design.items.length} items · ${design.measures.length} ${design.measures.length === 1 ? "measure" : "measures"}`}
        </div>
      </div>
    </button>
  );
}

/* ───────────── Previews ───────────── */

/**
 * Two versions' rates settling as runs come in. Neither is set to win: the
 * bars wander and cross, because the point of running is not knowing yet.
 * The changed version is drawn in red so it's easy to tell apart.
 */
function CompareBars({ a, b, measure, seed }: { a: string; b: string; measure: string; seed: number }) {
  const tick = useTick(120, 90);
  const runs = Math.min(30, Math.floor(tick / 3) + 1);
  // Noise shrinks as runs accumulate, like a real estimate does.
  const spread = 22 / Math.sqrt(runs);
  const wa = 50 + spread * Math.sin(tick * 0.21 + seed);
  const wb = 50 + spread * Math.sin(tick * 0.17 + seed * 2.3);
  return (
    <div className={PREVIEW} aria-hidden>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet truncate">{measure}</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">{runs} runs</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-2">
        {[
          { label: a, w: wa, color: "bg-ink/70" },
          { label: b, w: wb, color: "bg-highlight" },
        ].map((r) => (
          <div key={r.label} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-2">
            <span className="font-mono text-[9px] text-ink-muted truncate">{r.label}</span>
            <div className="h-[6px] rounded-full bg-line/60 overflow-hidden">
              <div className={`h-full rounded-full ${r.color} transition-[width] duration-300`} style={{ width: `${r.w}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A playground's setup hopping into the lab. */
function FromPlayPreview() {
  const tick = useTick(50, 70);
  const moved = tick > 22;
  return (
    <div className={PREVIEW} aria-hidden>
      <div className="flex items-center gap-2 h-full">
        <div className="flex-1 bg-surface rounded-[8px] p-2 min-w-0">
          <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">Playground</span>
          <span className="block font-mono text-[10px] text-ink truncate">Tone: warm</span>
        </div>
        <span className={`font-mono text-[11px] transition-colors ${moved ? "text-highlight" : "text-ink-quiet"}`}>→</span>
        <div
          className={`flex-1 rounded-[8px] p-2 min-w-0 border transition-colors ${
            moved ? "border-highlight bg-highlight-soft" : "border-dashed border-line"
          }`}
        >
          <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">Experiment</span>
          <span className={`block font-mono text-[10px] truncate ${moved ? "text-highlight-ink" : "text-ink-quiet"}`}>
            {moved ? "warm vs neutral" : "…"}
          </span>
        </div>
      </div>
    </div>
  );
}

const SCRATCH_Q = "Does a friendlier prompt make the model agree more?";

/** A blank design filling itself in. */
function ScratchPreview() {
  const tick = useTick(90, 55);
  const chars = Math.round(Math.min(1, tick / 50) * SCRATCH_Q.length);
  const versions = tick > 55;
  return (
    <div className={PREVIEW} aria-hidden>
      <span className="block font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">Question</span>
      <span className="block font-mono text-[10px] text-ink truncate">
        {SCRATCH_Q.slice(0, chars)}
        {chars < SCRATCH_Q.length && <span className="inline-block w-[3px] h-[8px] bg-ink ml-px align-middle animate-pulse" />}
      </span>
      <div className="mt-2 flex gap-1.5">
        {["Baseline", "Friendly"].map((v, i) => (
          <span
            key={v}
            className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
              versions ? (i === 1 ? "bg-highlight-soft text-highlight-ink" : "bg-ink text-canvas") : "bg-line/60 text-ink-quiet"
            }`}
          >
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}
