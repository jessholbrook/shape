"use client";

import type { ProviderId } from "@/lib/providers";
import { useHostedStatus } from "@/lib/hooks/use-hosted-status";

/** Shown under a provider picker when the free tier is selected: what's left, and where prompts go. */
export function HostedNote({ provider }: { provider: ProviderId }) {
  const hosted = useHostedStatus();
  if (provider !== "shape-free") return null;
  const left = hosted.resolved
    ? hosted.enabled
      ? `${hosted.remaining} of ${hosted.limit} free runs left today`
      : "Free runs are used up or unavailable right now — add a key in Settings, or pick the in-browser model"
    : "Checking free runs…";
  return (
    <p className="font-mono text-[11px] leading-[1.5] text-ink-quiet" data-testid="hosted-note">
      <span className={hosted.resolved && !hosted.enabled ? "text-warning" : "text-ink-muted"}>{left}.</span> Prompts go to
      Anthropic through Shape&apos;s server and aren&apos;t stored.
    </p>
  );
}
