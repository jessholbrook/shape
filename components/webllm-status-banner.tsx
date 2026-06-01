"use client";

import { useWebLLMStatus } from "@/lib/hooks/use-webllm-status";

/**
 * Bottom-pinned banner that surfaces in-browser model download progress.
 * Renders nothing when the engine is idle, ready, unsupported, or errored —
 * those states get communicated elsewhere (inline error message on the
 * playground, an unsupported-browser note on the home page, etc.).
 */
export function WebLLMStatusBanner() {
  const status = useWebLLMStatus();
  if (status.kind !== "loading") return null;

  const percent = Math.max(0, Math.min(100, Math.round(status.progress * 100)));

  return (
    <div
      data-print-hide
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[min(420px,calc(100vw-32px))] bg-ink text-canvas rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] px-4 py-3 flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-canvas/70">
          Downloading free model — one time
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight">
          {percent}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-canvas/10 overflow-hidden">
        <div
          className="h-full bg-highlight transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="font-sans text-[12px] leading-[1.4] text-canvas/80 truncate">
        {status.message}
      </span>
    </div>
  );
}
