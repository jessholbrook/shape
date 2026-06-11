"use client";

import Link from "next/link";
import { useWebLLMStatus } from "@/lib/hooks/use-webllm-status";

/**
 * Shown when the selected provider is the free in-browser model but the
 * browser has no WebGPU. Renders nothing while supported, so playgrounds can
 * mount it unconditionally with `show={provider === "webllm"}`.
 */
export function WebLLMUnsupportedBanner({ show }: { show: boolean }) {
  const status = useWebLLMStatus();
  if (!show || status.kind !== "unsupported") return null;

  return (
    <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
      <p className="font-sans text-[14px] leading-[1.5] text-ink">
        This browser can&apos;t run the free in-browser models — WebGPU
        isn&apos;t available. Chrome and Edge support it. Or bring your own
        key to use Anthropic or OpenAI instead.
      </p>
      <Link
        href="/settings/keys"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
      >
        Set up keys →
      </Link>
    </div>
  );
}
