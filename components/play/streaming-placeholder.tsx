"use client";

import { useWebLLMStatus } from "@/lib/hooks/use-webllm-status";

/**
 * The italic placeholder shown while a run has produced no text yet. When the
 * in-browser model is still downloading, says so — first-run users otherwise
 * stare at "Streaming…" for minutes wondering if something broke.
 */
export function StreamingPlaceholder() {
  const status = useWebLLMStatus();
  if (status.kind === "loading") {
    const percent = Math.max(
      0,
      Math.min(100, Math.round(status.progress * 100)),
    );
    return (
      <span className="text-ink-quiet italic">
        Downloading the free model — {percent}%. One-time download; streaming
        starts when it finishes.
      </span>
    );
  }
  return <span className="text-ink-quiet italic">Streaming…</span>;
}
