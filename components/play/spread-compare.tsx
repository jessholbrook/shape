"use client";

import { useMemo } from "react";
import {
  diffWords,
  divergenceRatio,
  type DiffSegment,
} from "@/lib/diff-words";
import type { SpreadRun } from "@/lib/spread";

/** Matches Diff Mode's guard — past this, word highlights paint everything. */
const DIVERGENCE_THRESHOLD = 0.6;

/**
 * The expensive half of the similarity work. Ranking all N runs uses a cheap
 * token-set Jaccard; the word-level LCS only ever runs on the single pair the
 * user opens here, which keeps a 10-run session off the main thread's back.
 */
export function SpreadCompare({
  a,
  b,
  labelA,
  labelB,
  onClose,
}: {
  a: SpreadRun;
  b: SpreadRun;
  labelA: string;
  labelB: string;
  onClose: () => void;
}) {
  const result = useMemo(() => {
    const pair = diffWords(a.text, b.text);
    return { pair, divergence: divergenceRatio(pair) };
  }, [a.text, b.text]);

  const tooDivergent = result.divergence >= DIVERGENCE_THRESHOLD;

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Comparing {labelA} and {labelB}
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            {Math.round(result.divergence * 100)}% different
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>
      </div>

      {tooDivergent && (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          These two diverge too much for word-level highlights — they&apos;d
          paint almost everything.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Side
          label={labelA}
          segments={tooDivergent ? null : result.pair.left}
          text={a.text}
        />
        <Side
          label={labelB}
          segments={tooDivergent ? null : result.pair.right}
          text={b.text}
        />
      </div>
    </div>
  );
}

function Side({
  label,
  segments,
  text,
}: {
  label: string;
  segments: DiffSegment[] | null;
  text: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {label}
      </span>
      <p className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
        {segments
          ? segments.map((seg, i) => <Segment key={i} segment={seg} />)
          : text}
      </p>
    </div>
  );
}

function Segment({ segment }: { segment: DiffSegment }) {
  if (segment.kind === "same") return <span>{segment.text}</span>;
  return (
    <span className="bg-highlight-soft text-highlight-ink rounded-sm px-0.5">
      {segment.text}
    </span>
  );
}
