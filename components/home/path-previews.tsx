"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES } from "@/lib/curriculum";
import { PLAYGROUNDS } from "@/lib/playgrounds";
import { LENS_IDS, LENSES } from "@/lib/lenses";

/**
 * Small looping previews for the home page's ways in, in the same style as
 * the playground previews: a ~88px panel, mono type, a few seconds a loop.
 */

const WRAPPER = "relative h-[88px] rounded-[12px] bg-canvas border border-line p-3 overflow-hidden";

function useTick(period: number, ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % period), ms);
    return () => clearInterval(id);
  }, [period, ms]);
  return tick;
}

/* ───────────── Reading: a lesson page filling in, line by line ───────────── */

const LESSON_LINES = [92, 100, 84];
const FIRST = MODULES.find((m) => m.num === "01")!;

export function ReadingPreview() {
  const tick = useTick(70, 60);
  return (
    <div className={WRAPPER} aria-hidden>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">Lesson {FIRST.num}</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">{FIRST.readMinutes} min</span>
      </div>
      <p className="font-display text-[13px] leading-[1.2] text-ink mt-1">
        {FIRST.title} {FIRST.italic && <span className="italic">{FIRST.italic}</span>}
      </p>
      <div className="mt-1.5 flex flex-col gap-[5px]">
        {LESSON_LINES.map((w, i) => {
          const start = i * 14;
          const fill = Math.max(0, Math.min(1, (tick - start) / 14));
          return (
            <div key={i} className="h-[4px] rounded-full bg-line/70 overflow-hidden" style={{ width: `${w}%` }}>
              <div className={`h-full rounded-full ${i === 1 ? "bg-highlight" : "bg-ink/60"}`} style={{ width: `${fill * 100}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────── Doing: flip one setting, the answer changes ───────────── */

const DOING = [
  { setting: "Formal", answer: "Thank you for your inquiry." },
  { setting: "Casual", answer: "Hey! Happy to help." },
];

export function DoingPreview() {
  const tick = useTick(60, 60);
  const i = tick < 30 ? 0 : 1;
  const chars = Math.round(Math.min(1, (tick % 30) / 18) * DOING[i].answer.length);
  return (
    <div className={WRAPPER} aria-hidden>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet mr-1">Tone</span>
        {DOING.map((d, j) => (
          <span
            key={d.setting}
            className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
              i === j ? "bg-ink text-canvas" : "bg-line/60 text-ink-muted"
            }`}
          >
            {d.setting}
          </span>
        ))}
        <span className="ml-auto font-mono text-[9px] text-highlight">Run ↻</span>
      </div>
      <div className="mt-2.5 bg-surface rounded-[8px] px-2 py-1.5">
        <span className="font-mono text-[10px] leading-[1.35] text-ink">
          {DOING[i].answer.slice(0, chars)}
          {chars < DOING[i].answer.length && (
            <span className="inline-block w-[3px] h-[8px] bg-ink ml-px align-middle animate-pulse" />
          )}
        </span>
      </div>
    </div>
  );
}

/* ───────────── Role: each background lights up its own path ───────────── */

const PATH_STEPS = ["Lesson", "Playground", "Lab"];

export function RolePreview() {
  const tick = useTick(LENS_IDS.length * 20, 60);
  const active = Math.floor(tick / 20);
  const step = Math.min(PATH_STEPS.length, Math.floor((tick % 20) / 5));
  return (
    <div className={WRAPPER} aria-hidden>
      <div className="flex flex-wrap gap-1">
        {LENS_IDS.map((id, i) => (
          <span
            key={id}
            className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full transition-colors ${
              i === active ? "bg-ink text-canvas" : "bg-line/60 text-ink-muted"
            }`}
          >
            {LENSES[id].short}
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {PATH_STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={`font-mono text-[9px] px-1.5 py-0.5 rounded-[6px] border transition-colors ${
                i < step ? "border-highlight text-highlight-ink bg-highlight-soft" : "border-line text-ink-quiet"
              }`}
            >
              {s}
            </span>
            {i < PATH_STEPS.length - 1 && <span className="font-mono text-[9px] text-ink-quiet">→</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ───────────── I'm feeling lucky: a random lesson or playground ───────────── */

type Destination = { href: string; label: string; kind: "Lesson" | "Playground" };

const DESTINATIONS: Destination[] = [
  ...MODULES.filter((m) => m.status === "ready" && m.href.startsWith("/learn/")).map((m) => ({
    href: m.href,
    label: m.italic ? `${m.title} ${m.italic}` : m.title,
    kind: "Lesson" as const,
  })),
  ...PLAYGROUNDS.filter((p) => p.status === "ready").map((p) => ({
    href: p.href,
    label: `${p.title} ${p.italic}`,
    kind: "Playground" as const,
  })),
];

function LuckyPreview() {
  const tick = useTick(DESTINATIONS.length * 4, 180);
  const d = DESTINATIONS[Math.floor(tick / 4) % DESTINATIONS.length];
  return (
    <div className={WRAPPER} aria-hidden>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">Shuffling</span>
        {/* Drawn, not a ⚄ glyph: Geist Mono has no die and fell back to a box. */}
        <svg viewBox="0 0 16 16" className="w-[14px] h-[14px] text-highlight" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="currentColor" strokeWidth="1.4" />
          {[
            [5, 5],
            [11, 5],
            [8, 8],
            [5, 11],
            [11, 11],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.2" fill="currentColor" />
          ))}
        </svg>
      </div>
      <div className="mt-2.5 bg-surface rounded-[8px] px-2 py-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] leading-[1.35] text-ink truncate">{d.label}</span>
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">{d.kind}</span>
      </div>
    </div>
  );
}

/** A card that sends the reader to a random lesson or playground. */
export function LuckyCard() {
  const router = useRouter();
  function go() {
    const d = DESTINATIONS[Math.floor(Math.random() * DESTINATIONS.length)];
    router.push(d.href);
  }
  return (
    <button
      type="button"
      onClick={go}
      data-testid="lucky-card"
      className="group text-left flex flex-col bg-surface border border-line rounded-[16px] p-6 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex items-center justify-end">
        <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">Go →</span>
      </div>
      <h3 className="font-display text-[28px] md:text-[34px] leading-[1.1] tracking-tight text-ink mt-6">
        I&apos;m feeling <span className="italic">lucky!</span>
      </h3>
      <div className="mt-4">
        <LuckyPreview />
      </div>
      <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">
        Not sure where to start? Jump to a random lesson or playground.
      </p>
      <div className="mt-auto pt-4">
        <div className="pt-4 border-t border-line">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            {DESTINATIONS.length} places to land
          </span>
        </div>
      </div>
    </button>
  );
}
