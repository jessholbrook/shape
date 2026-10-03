"use client";

import { PROVIDER_LIST, type ProviderId } from "@/lib/providers";
import { useHostedStatus } from "@/lib/hooks/use-hosted-status";

/**
 * The <option>s for a provider picker. The hosted free tier is listed only
 * while it's open — except when it's the current selection, which always
 * stays visible so a picker never shows a value it doesn't list.
 */
export function ProviderOptions({ current }: { current: ProviderId }) {
  const hosted = useHostedStatus();
  return (
    <>
      {PROVIDER_LIST.filter((p) => p.id !== "shape-free" || hosted.enabled || current === "shape-free").map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </>
  );
}
