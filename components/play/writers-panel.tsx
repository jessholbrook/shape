"use client";

import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import type { Writers } from "@/lib/judge";
import { ModelSelect } from "./model-select";
import { InfoTip } from "@/components/info-tip";

/**
 * Two writers. Each answers every request, and each then judges the pair —
 * so the same model is asked, in effect, "which is better: yours or theirs?"
 * The more different the two are (different families, not just sizes), the
 * more the answer means.
 */
export function WritersPanel({
  writers,
  onChange,
  keyFor,
  disabled,
}: {
  writers: Writers;
  onChange: (next: Writers) => void;
  keyFor: (provider: ProviderId) => boolean;
  disabled?: boolean;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
        Two writers, each also a judge
        <InfoTip>
          Both write an answer to every request; then each one judges the
          pair, both ways. Pick two different families if you can — two sizes
          of one model tend to agree, which tells you less.
        </InfoTip>
      </span>
      <div className="flex flex-col gap-3">
        {(["a", "b"] as const).map((side) => {
          const w = writers[side];
          const connected = keyFor(w.provider);
          return (
            <div key={side} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink w-16 shrink-0">
                Writer {side.toUpperCase()}
              </span>
              <select
                value={w.provider}
                disabled={disabled}
                onChange={(e) => {
                  const next = e.target.value as ProviderId;
                  onChange({
                    ...writers,
                    [side]: { provider: next, model: PROVIDERS[next].defaultModel },
                  });
                }}
                aria-label={`Writer ${side.toUpperCase()} provider`}
                className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
              >
                {PROVIDER_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ModelSelect
                provider={w.provider}
                model={w.model}
                onChange={(model) => onChange({ ...writers, [side]: { ...w, model } })}
                ariaLabel={`Writer ${side.toUpperCase()} model`}
                className="flex-1 min-w-[180px] bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
              />
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1 w-16 shrink-0 ${
                  connected ? "text-success" : "text-danger"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success" : "bg-danger"}`}
                />
                {connected ? "Key" : "No key"}
              </span>
            </div>
          );
        })}
      </div>
      <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
        Writing uses the temperature above. Judging always runs at 0.2 — it
        is a reading, not a writing.
      </p>
    </div>
  );
}
