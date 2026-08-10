"use client";

import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";
import type { Assertion, SpreadRun } from "@/lib/spread";
import { assertionLabel, checkAssertion } from "@/lib/spread";

/**
 * One generation out of N. Carries its own per-assertion pass/fail strip so a
 * failing run is legible on its own, not only in the aggregate report — and a
 * "median" / "outlier" badge from the typicality ranking.
 */
export function SpreadRunCard({
  run,
  num,
  assertions,
  selected,
  onToggleSelect,
  selectable,
}: {
  run: SpreadRun;
  num: number;
  assertions: Assertion[];
  selected: boolean;
  onToggleSelect: () => void;
  selectable: boolean;
}) {
  const elapsed =
    run.startMs && run.endMs
      ? ((run.endMs - run.startMs) / 1000).toFixed(1) + "s"
      : null;
  const done = run.status === "done";
  const failures = done
    ? assertions.filter((a) => !checkAssertion(a, run.text))
    : [];

  return (
    <div
      className={`bg-surface border rounded-[14px] p-4 flex flex-col gap-3 transition-colors ${
        selected ? "border-ink" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            Run {num}
          </span>
          <TypicalityBadge run={run} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {done && !!run.text && (
            <ShareActions
              copyText={run.text}
              filenameStem={`spread-run${num}`}
              markdown={[
                `# Shape — Spread run ${num}`,
                "",
                run.text,
                "",
              ].join("\n")}
            />
          )}
          <StatusDot status={run.status} />
        </div>
      </div>

      <div className="flex-1 font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[100px]">
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
          <span className="text-ink-quiet italic">Not run yet.</span>
        )}
      </div>

      {done && assertions.length > 0 && (
        <div className="border-t border-line pt-3 flex flex-wrap gap-1.5">
          {failures.length === 0 ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              All clauses held
            </span>
          ) : (
            failures.map((a) => (
              <span
                key={a.id}
                className="font-mono text-[10px] text-danger border border-danger/40 rounded-full px-2 py-0.5"
                title={`This run failed: ${assertionLabel(a)}`}
              >
                ✕ {assertionLabel(a)}
              </span>
            ))
          )}
        </div>
      )}

      {(done || run.status === "error") && (
        <div className="border-t border-line pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {run.outputTokens != null && <span>out {run.outputTokens} tok</span>}
          {run.costUsd != null && (
            <span className="text-ink">
              {run.costUsd < 0.01 ? "<$0.01" : `$${run.costUsd.toFixed(3)}`}
            </span>
          )}
          {elapsed && <span>{elapsed}</span>}
          {done && (
            <button
              type="button"
              onClick={onToggleSelect}
              disabled={!selectable && !selected}
              className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {selected ? "Selected ✓" : "Compare"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The medoid carries "median"; the run furthest from it carries "outlier".
 * Only meaningful once `rankRuns` has stamped distances, so both badges stay
 * hidden until then.
 */
function TypicalityBadge({ run }: { run: SpreadRun }) {
  if (run.distance == null) return null;
  if (run.isMedoid) {
    return (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5 shrink-0"
        title="The most typical run — closest to all the others"
      >
        Median
      </span>
    );
  }
  // Distance is measured on normalized tokens, so a run can sit at 0 while
  // still differing in punctuation or case. Saying "same wording" is honest
  // about what was compared; "0% off" would read as a bug next to a visible
  // difference.
  if (run.distance === 0) {
    return (
      <span
        className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quiet shrink-0"
        title="Same words as the median, ignoring case and punctuation"
      >
        Same wording
      </span>
    );
  }
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quiet shrink-0">
      {Math.round(run.distance * 100)}% off
    </span>
  );
}

function StatusDot({ status }: { status: SpreadRun["status"] }) {
  if (status === "idle") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Idle
      </span>
    );
  }
  const color =
    status === "running"
      ? "bg-highlight animate-pulse"
      : status === "done"
      ? "bg-success"
      : "bg-danger";
  return <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`} />;
}
