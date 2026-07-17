"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useWebLLMStatus } from "@/lib/hooks/use-webllm-status";
import { probeWebGPUAdapter } from "@/lib/webllm-engine";

/**
 * Shown when the selected provider is the free in-browser model but the
 * browser can't actually run it — either no WebGPU API at all, or the API is
 * present but hands out no compatible GPU adapter. Renders nothing while
 * supported, so playgrounds can mount it unconditionally with
 * `show={provider === "webllm"}`.
 */
export function WebLLMUnsupportedBanner({ show }: { show: boolean }) {
  const status = useWebLLMStatus();

  // Probe the GPU adapter as soon as the in-browser provider is selected, so
  // an unsupported machine sees this banner before clicking Run rather than a
  // cryptic error after.
  useEffect(() => {
    if (show) probeWebGPUAdapter();
  }, [show]);

  if (!show || status.kind !== "unsupported") return null;

  return (
    <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
      <p className="font-sans text-[14px] leading-[1.5] text-ink">
        This browser can&apos;t run the free in-browser models — there&apos;s
        no compatible GPU here (common on Linux without drivers or in a virtual
        machine). Chrome or Edge on a machine with a supported GPU works, or
        bring your own key to use Anthropic, OpenAI, or Google instead.
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
