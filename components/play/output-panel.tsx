"use client";

import { PROVIDERS } from "@/lib/providers";
import type { ConfigState } from "./config-panel";

export type OutputState = {
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  startMs?: number;
  endMs?: number;
};

export function OutputPanel({
  label,
  config,
  output,
}: {
  label: string;
  config: ConfigState;
  output: OutputState;
}) {
  const modelName =
    PROVIDERS[config.provider].models.find((m) => m.id === config.model)?.name ??
    config.model;

  const elapsed =
    output.startMs && output.endMs
      ? ((output.endMs - output.startMs) / 1000).toFixed(1) + "s"
      : output.startMs
      ? "…"
      : "";

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            {label}
          </span>
          <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
            {modelName}
          </span>
        </div>
        <StatusPill status={output.status} />
      </div>

      <div className="flex-1 font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[180px]">
        {output.error ? (
          <span className="text-danger">{output.error}</span>
        ) : output.text ? (
          <>
            {output.text}
            {output.status === "running" && (
              <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
            )}
          </>
        ) : (
          <span className="text-ink-quiet italic">
            Output will stream here.
          </span>
        )}
      </div>

      {(output.status === "done" || output.status === "error") && (
        <div className="border-t border-line pt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          <span>in {output.inputTokens} tok</span>
          <span>out {output.outputTokens} tok</span>
          <span className="text-ink">
            {output.costUsd < 0.01
              ? "<$0.01"
              : `$${output.costUsd.toFixed(3)}`}
          </span>
          {elapsed && <span>{elapsed}</span>}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: OutputState["status"] }) {
  if (status === "idle") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Idle
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink">
        <span className="w-1.5 h-1.5 rounded-full bg-highlight animate-pulse" />
        Streaming
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Done
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-danger">
      <span className="w-1.5 h-1.5 rounded-full bg-danger" /> Error
    </span>
  );
}
