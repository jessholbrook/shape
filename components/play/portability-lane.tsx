"use client";

import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";
import { assertionLabel, checkAssertion, type Assertion } from "@/lib/spread";
import { modelLabel, type LaneResult, type ModelRef } from "@/lib/portability";

/**
 * One model's outputs, with the clauses it failed called out per run. The
 * matrix says *that* a clause didn't travel; this is where you read the text
 * and see *how* it didn't.
 */
export function PortabilityLane({
  modelRef,
  lane,
  assertions,
}: {
  modelRef: ModelRef;
  lane: LaneResult | undefined;
  assertions: Assertion[];
}) {
  const runs = lane?.runs ?? [];
  const label = modelLabel(modelRef);

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5 truncate">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet shrink-0">
          {runs.filter((r) => r.status === "done").length}/{runs.length || "—"}{" "}
          done
        </span>
      </div>

      {runs.length === 0 && (
        <p className="font-mono text-[11px] text-ink-quiet italic min-h-[80px]">
          Not run yet.
        </p>
      )}

      {runs.map((run, i) => {
        const failures =
          run.status === "done"
            ? assertions.filter((a) => !checkAssertion(a, run.text))
            : [];
        return (
          <div
            key={i}
            className="border-t border-line pt-3 first-of-type:border-t-0 first-of-type:pt-0 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
                Run {i + 1}
              </span>
              {run.status === "done" && !!run.text && (
                <ShareActions
                  copyText={run.text}
                  filenameStem={`portability-${label
                    .toLowerCase()
                    .replace(/\s+/g, "-")}-${i + 1}`}
                  markdown={`# ${label} — run ${i + 1}\n\n${run.text}\n`}
                />
              )}
            </div>
            <div className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[48px]">
              {run.error ? (
                <span className="text-danger">{run.error}</span>
              ) : run.text ? (
                <>
                  {run.text}
                  {run.status === "running" && (
                    <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
                  )}
                </>
              ) : run.status === "running" ? (
                <StreamingPlaceholder />
              ) : (
                <span className="text-ink-quiet italic">Waiting…</span>
              )}
            </div>
            {run.status === "done" && failures.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {failures.map((a) => (
                  <span
                    key={a.id}
                    className="font-mono text-[9px] text-danger border border-danger/40 rounded-full px-2 py-0.5"
                  >
                    ✕ {assertionLabel(a)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
