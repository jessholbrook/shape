"use client";

import { PROVIDERS } from "@/lib/providers";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";
import {
  formatCost,
  formatMs,
  tokensPerSecond,
  totalMs,
  ttftMs,
  type RaceResult,
} from "@/lib/race";
import type { ConfigState } from "./config-panel";

/**
 * One lane's output with its three measures on top. The metrics lead rather
 * than trail the text, because the whole point is to have the speed and cost
 * in view *while* reading the quality — judging the words first and the bill
 * afterwards is how you end up shipping the expensive one by default.
 */
export function RaceLane({
  label,
  config,
  result,
  winner,
}: {
  label: string;
  config: ConfigState;
  result: RaceResult;
  /** Marks the lane that finished first, once both are done. */
  winner: boolean;
}) {
  const modelName =
    PROVIDERS[config.provider].models.find((m) => m.id === config.model)
      ?.name ?? config.model;
  const tps = tokensPerSecond(result);
  const done = result.status === "done";

  return (
    <div
      className={`bg-surface border rounded-[16px] p-5 flex flex-col gap-4 ${
        winner ? "border-highlight" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            {label}
          </span>
          <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5 truncate">
            {modelName}
          </span>
          {winner && (
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-highlight-ink shrink-0">
              first
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {done && !!result.text && (
            <ShareActions
              copyText={result.text}
              filenameStem={`race-${label.toLowerCase().replace(/\s+/g, "-")}`}
              markdown={[
                `# Shape — Race, ${label} (${modelName})`,
                "",
                `First token ${formatMs(ttftMs(result))} · total ${formatMs(
                  totalMs(result),
                )} · ${tps ? `${Math.round(tps)} tok/s · ` : ""}${formatCost(
                  result.costUsd,
                )}`,
                "",
                result.text,
                "",
              ].join("\n")}
            />
          )}
          <StatusDot status={result.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Metric label="First token" value={formatMs(ttftMs(result))} />
        <Metric
          label="Throughput"
          value={tps == null ? "—" : `${Math.round(tps)} tok/s`}
        />
        <Metric label="Cost" value={formatCost(result.costUsd)} />
      </div>

      <div className="flex-1 font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words min-h-[160px] border-t border-line pt-4">
        {result.error ? (
          <span className="text-danger">{result.error}</span>
        ) : result.text ? (
          <>
            {result.text}
            {result.status === "running" && (
              <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
            )}
          </>
        ) : result.status === "running" ? (
          <StreamingPlaceholder />
        ) : (
          <span className="text-ink-quiet italic">Output will stream here.</span>
        )}
      </div>

      {(done || result.status === "error") && (
        <div className="border-t border-line pt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {result.inputTokens != null && <span>in {result.inputTokens} tok</span>}
          {result.outputTokens != null && (
            <span>out {result.outputTokens} tok</span>
          )}
          <span className="ml-auto">total {formatMs(totalMs(result))}</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canvas border border-line rounded-[10px] px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </p>
      <p className="font-mono text-[15px] text-ink mt-0.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function StatusDot({ status }: { status: RaceResult["status"] }) {
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
