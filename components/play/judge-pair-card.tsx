"use client";

import { useState } from "react";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";
import type { JudgeRun, Padded, Pick } from "@/lib/judge";

/**
 * A pair's judgements, side by side, one section per pass: the plain runs,
 * the padded runs when the length check is on, or one section per judge in
 * self-preference mode. Reading two rationales against each other is where
 * a flip stops being a statistic — the same model argues confidently for
 * opposite answers, in the same voice, minutes apart.
 */
export type PairCardSection = {
  key: string;
  title: string;
  /** Tone of the title — the verdict for this section. */
  verdict: string;
  verdictTone: "danger" | "success" | "quiet";
  ab?: JudgeRun;
  ba?: JudgeRun;
  pickAB: Pick;
  pickBA: Pick;
  /** The padded answer, when this section judged one. */
  padded?: Padded | null;
};

export function JudgePairCard({
  label,
  sections,
}: {
  label: string;
  sections: PairCardSection[];
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
        {label}
      </span>
      {sections.map((s) => (
        <Section key={s.key} section={s} pairLabel={label} />
      ))}
    </div>
  );
}

function Section({ section, pairLabel }: { section: PairCardSection; pairLabel: string }) {
  const [showPadded, setShowPadded] = useState(false);
  const tone =
    section.verdictTone === "danger"
      ? "text-danger"
      : section.verdictTone === "success"
        ? "text-success"
        : "text-ink-quiet";
  return (
    <div className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          {section.title}
        </span>
        <span className={`font-mono text-[10px] uppercase tracking-[0.08em] ${tone}`}>
          {section.verdict}
        </span>
      </div>
      {section.padded && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setShowPadded((v) => !v)}
            className="self-start font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Answer {section.padded.paddedSide.toUpperCase()} padded from{" "}
            {section.padded.from} to {section.padded.to} characters ·{" "}
            {showPadded ? "hide" : "show"}
          </button>
          {showPadded && (
            <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[200px] overflow-y-auto text-ink-muted">
              {section.padded.paddedSide === "a" ? section.padded.pair.a : section.padded.pair.b}
            </pre>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RunSide
          heading="As written (A, then B)"
          run={section.ab}
          pick={section.pickAB}
          stem={`judge-${pairLabel}-${section.key}-ab`}
        />
        <RunSide
          heading="Swapped (B, then A)"
          run={section.ba}
          pick={section.pickBA}
          stem={`judge-${pairLabel}-${section.key}-ba`}
        />
      </div>
    </div>
  );
}

function RunSide({
  heading,
  run,
  pick,
  stem,
}: {
  heading: string;
  run: JudgeRun | undefined;
  pick: string;
  stem: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
          {heading}
        </span>
        {run?.status === "done" && !!run.raw && (
          <ShareActions
            copyText={run.raw}
            filenameStem={stem.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}
            markdown={`# ${heading}\n\n${run.raw}\n`}
          />
        )}
      </div>
      <div className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[64px] max-h-[220px] overflow-y-auto">
        {run?.error ? (
          <span className="text-danger">{run.error}</span>
        ) : run?.raw ? (
          run.raw
        ) : run?.status === "running" ? (
          <StreamingPlaceholder />
        ) : (
          <span className="text-ink-quiet italic">Not run yet.</span>
        )}
      </div>
      {run?.status === "done" && (
        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quiet">
          chose{" "}
          <span className="text-ink">
            {pick === "a" || pick === "b"
              ? pick.toUpperCase()
              : pick === "tie"
                ? "tie"
                : "nothing readable"}
          </span>
        </span>
      )}
    </div>
  );
}
