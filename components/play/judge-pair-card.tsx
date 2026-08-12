"use client";

import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";
import { VERDICT_LABEL, type JudgeRun, type PairRow } from "@/lib/judge";

/**
 * Both judgements of one pair, side by side. Reading the two rationales
 * against each other is where a flip stops being a statistic — the same model
 * argues confidently for opposite answers, in the same voice, minutes apart.
 */
export function JudgePairCard({ row }: { row: PairRow }) {
  const ab = row.runs.find((r) => r.order === "ab");
  const ba = row.runs.find((r) => r.order === "ba");

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
          {row.pair.label}
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] ${
            row.verdict === "position-flipped"
              ? "text-danger"
              : row.verdict === "agrees"
              ? "text-success"
              : "text-ink-quiet"
          }`}
        >
          {VERDICT_LABEL[row.verdict]}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RunSide
          heading="As written (A, then B)"
          run={ab}
          pick={row.pickAB}
          stem={`judge-${row.pair.id}-ab`}
        />
        <RunSide
          heading="Swapped (B, then A)"
          run={ba}
          pick={row.pickBA}
          stem={`judge-${row.pair.id}-ba`}
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
            filenameStem={stem}
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
