"use client";

import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  MAX_MODELS,
  MIN_MODELS,
  newRefId,
  type ModelRef,
} from "@/lib/portability";

/**
 * The list of models a spec gets tested against. Deliberately *not* a
 * ConfigPanel per model — the system prompt and temperature are shared here,
 * because a spec that has to be reworded per vendor isn't the thing being
 * measured.
 */
export function ModelRoster({
  refs,
  onChange,
  keyFor,
}: {
  refs: ModelRef[];
  onChange: (next: ModelRef[]) => void;
  /** Whether a usable key exists for this provider. */
  keyFor: (provider: ProviderId) => boolean;
}) {
  function update(id: string, patch: Partial<ModelRef>) {
    onChange(refs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Models · {refs.length}
        </span>
        <button
          type="button"
          disabled={refs.length >= MAX_MODELS}
          onClick={() =>
            onChange([
              ...refs,
              {
                id: newRefId(),
                provider: "webllm",
                model: PROVIDERS.webllm.defaultModel,
              },
            ])
          }
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add model
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {refs.map((ref, i) => {
          const provider = PROVIDERS[ref.provider];
          const connected = keyFor(ref.provider);
          return (
            <div key={ref.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet w-6 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <select
                value={ref.provider}
                onChange={(e) => {
                  const next = e.target.value as ProviderId;
                  update(ref.id, {
                    provider: next,
                    model: PROVIDERS[next].defaultModel,
                  });
                }}
                aria-label={`Provider for model ${i + 1}`}
                className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
              >
                {PROVIDER_LIST.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={ref.model}
                onChange={(e) => update(ref.id, { model: e.target.value })}
                aria-label={`Model ${i + 1}`}
                className="flex-1 min-w-[180px] bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1 w-16 shrink-0 ${
                  connected ? "text-success" : "text-danger"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connected ? "bg-success" : "bg-danger"
                  }`}
                />
                {connected ? "Key" : "No key"}
              </span>
              <button
                type="button"
                onClick={() => onChange(refs.filter((r) => r.id !== ref.id))}
                disabled={refs.length <= MIN_MODELS}
                aria-label={`Remove model ${i + 1}`}
                className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-[18px] leading-none text-ink-quiet hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
        Two to {MAX_MODELS} models. The more different they are — different
        vendors, different sizes — the more the matrix tells you.
      </p>
    </div>
  );
}
