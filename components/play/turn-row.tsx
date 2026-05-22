"use client";

import { PROVIDERS } from "@/lib/providers";
import type { DiffTurn, DiffTurnOutput, DiffDraftConfig } from "@/lib/drafts";

export function TurnRow({
  num,
  turn,
  configA,
  configB,
  onDelete,
}: {
  num: number;
  turn: DiffTurn;
  configA: DiffDraftConfig;
  configB: DiffDraftConfig;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            Turn {num}
          </span>
          <p className="font-sans text-[14px] leading-[1.5] text-ink truncate min-w-0">
            {turn.userMessage || (
              <span className="italic text-ink-quiet">No prompt</span>
            )}
          </p>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger shrink-0"
          >
            Delete
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        <TurnOutput label="A" config={configA} output={turn.outputA} />
        <TurnOutput label="B" config={configB} output={turn.outputB} />
      </div>
    </div>
  );
}

function TurnOutput({
  label,
  config,
  output,
}: {
  label: string;
  config: DiffDraftConfig;
  output: DiffTurnOutput;
}) {
  const modelName =
    PROVIDERS[config.provider].models.find((m) => m.id === config.model)?.name ??
    config.model;
  const elapsed =
    output.startMs && output.endMs
      ? ((output.endMs - output.startMs) / 1000).toFixed(1) + "s"
      : null;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet shrink-0">
            {label}
          </span>
          <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5 truncate">
            {modelName}
          </span>
        </div>
        <StatusDot status={output.status} />
      </div>

      <div className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[80px]">
        {output.error ? (
          <span className="text-danger">{output.error}</span>
        ) : output.text ? (
          <>
            {output.text}
            {output.status === "running" && (
              <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
            )}
          </>
        ) : output.status === "running" ? (
          <span className="text-ink-quiet italic">Streaming…</span>
        ) : (
          <span className="text-ink-quiet italic">—</span>
        )}
      </div>

      {(output.status === "done" || output.status === "error") &&
        (output.inputTokens || output.outputTokens || elapsed) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            {output.inputTokens != null && (
              <span>in {output.inputTokens} tok</span>
            )}
            {output.outputTokens != null && (
              <span>out {output.outputTokens} tok</span>
            )}
            {output.costUsd != null && (
              <span className="text-ink">
                {output.costUsd < 0.01
                  ? "<$0.01"
                  : `$${output.costUsd.toFixed(3)}`}
              </span>
            )}
            {elapsed && <span>{elapsed}</span>}
          </div>
        )}
    </div>
  );
}

function StatusDot({ status }: { status: DiffTurnOutput["status"] }) {
  const color =
    status === "running"
      ? "bg-highlight animate-pulse"
      : status === "done"
      ? "bg-success"
      : "bg-danger";
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`}
      aria-label={status}
    />
  );
}
