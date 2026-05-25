"use client";

import { useEffect, useState } from "react";

/**
 * Small animated preview shown inside each homepage playground card.
 * Each preview loops on a ~3-4s cycle so the homepage feels alive without
 * pulling attention away from the typography.
 */

const PREVIEW_WRAPPER =
  "relative h-[88px] rounded-[12px] bg-canvas border border-line p-3 overflow-hidden";

/* ───────────────────────── Diff ───────────────────────── */

const DIFF_A = "Welcome — let's get started.";
const DIFF_B = "Welcome aboard! 🎉 So glad you're here!";

export function DiffPreview() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 80), 50);
    return () => clearInterval(id);
  }, []);

  // Type from 0..52, then hold, then reset.
  const typeFrame = Math.min(tick, 52);
  const charsA = Math.round((typeFrame / 52) * DIFF_A.length);
  const charsB = Math.round((typeFrame / 52) * DIFF_B.length);

  return (
    <div className={PREVIEW_WRAPPER}>
      <div className="grid grid-cols-2 gap-2 h-full">
        <Pane label="A" text={DIFF_A.slice(0, charsA)} typing={tick < 52} />
        <Pane label="B" text={DIFF_B.slice(0, charsB)} typing={tick < 52} />
      </div>
    </div>
  );
}

function Pane({
  label,
  text,
  typing,
}: {
  label: string;
  text: string;
  typing: boolean;
}) {
  return (
    <div className="bg-surface rounded-[8px] p-2 flex flex-col gap-1 min-w-0">
      <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      <span className="font-mono text-[10px] leading-[1.35] text-ink line-clamp-2">
        {text}
        {typing && (
          <span className="inline-block w-[3px] h-[8px] bg-ink ml-px align-middle animate-pulse" />
        )}
      </span>
    </div>
  );
}

/* ───────────────────────── Tone ───────────────────────── */

const TONE_STOPS = ["Clinical", "Reserved", "Neutral", "Warm", "Personal"];

export function TonePreview() {
  const [activeStop, setActiveStop] = useState(2);

  useEffect(() => {
    let dir = 1;
    let i = 2;
    const id = setInterval(() => {
      i += dir;
      if (i >= TONE_STOPS.length - 1) dir = -1;
      else if (i <= 0) dir = 1;
      setActiveStop(i);
    }, 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={PREVIEW_WRAPPER}>
      <div className="flex flex-col justify-between h-full">
        <div className="flex items-center justify-between font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet">
          <span>Warmth</span>
          <span
            className={`px-1.5 py-0.5 rounded-full ${
              activeStop === 2
                ? "bg-line/60 text-ink-muted"
                : "bg-highlight-soft text-highlight-ink"
            } transition-colors`}
          >
            {TONE_STOPS[activeStop]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {TONE_STOPS.map((_, i) => (
            <span
              key={i}
              className={`flex-1 h-[6px] rounded-full transition-colors ${
                i === activeStop ? "bg-ink" : "bg-line"
              }`}
            />
          ))}
        </div>
        <div className="font-mono text-[10px] leading-[1.35] text-ink-muted truncate">
          {toneLine(activeStop)}
        </div>
      </div>
    </div>
  );
}

function toneLine(stop: number): string {
  switch (stop) {
    case 0:
      return "Avoid first-person warmth.";
    case 1:
      return "Skip pleasantries.";
    case 2:
      return "—";
    case 3:
      return "Sound like a person, not a brand.";
    case 4:
      return "Like a friend you care about.";
    default:
      return "";
  }
}

/* ─────────────────────── Persona ──────────────────────── */

const PERSONA_LINES: { label: string; value: string }[] = [
  { label: "Name", value: "Iris" },
  { label: "Role", value: "Senior research mentor" },
  { label: "Voice", value: "Warm but precise" },
];

export function PersonaPreview() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 90), 50);
    return () => clearInterval(id);
  }, []);

  const charsPerLine = 20;
  const lines = PERSONA_LINES.map((l, i) => {
    const start = i * charsPerLine;
    const local = Math.max(0, Math.min(charsPerLine, tick - start));
    const fraction = local / charsPerLine;
    const chars = Math.round(fraction * l.value.length);
    return {
      label: l.label,
      value: l.value.slice(0, chars),
      typing: tick > start && tick < start + charsPerLine,
    };
  });

  return (
    <div className={PREVIEW_WRAPPER}>
      <div className="flex flex-col gap-1 h-full justify-center">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline gap-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-quiet w-[34px] shrink-0">
              {line.label}
            </span>
            <span className="font-mono text-[10px] leading-[1.35] text-ink truncate">
              {line.value}
              {line.typing && (
                <span className="inline-block w-[3px] h-[8px] bg-ink ml-px align-middle animate-pulse" />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
