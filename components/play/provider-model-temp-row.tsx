"use client";

import { useEffect } from "react";
import {
  PROVIDER_LIST,
  PROVIDERS,
  type ModelMeta,
  type ProviderId,
} from "@/lib/providers";
import { useLiveModels } from "@/lib/hooks/use-live-models";
import { InfoTip } from "@/components/info-tip";
import {
  ModelTip,
  ProviderTip,
  TemperatureTip,
  temperatureRegime,
} from "@/components/play/config-help";

/**
 * The Provider / Model / Temperature row that sits above every playground and
 * studio. Provider changes auto-reset the model to that provider's default,
 * which is the convention every surface had inlined before this was extracted.
 */
export function ProviderModelTempRow({
  provider,
  model,
  temperature,
  onProviderChange,
  onModelChange,
  onTemperatureChange,
}: {
  provider: ProviderId;
  model: string;
  temperature: number;
  onProviderChange: (next: ProviderId) => void;
  onModelChange: (next: string) => void;
  onTemperatureChange: (next: number) => void;
}) {
  const { models, status, error, refresh } = useLiveModels(provider, model);

  // A provider with no static catalog (the custom endpoint) starts with no
  // model; adopt the first one the API lists. Any other selection stays —
  // the merged list keeps a retired selection visible rather than swapping it.
  useEffect(() => {
    if (models.length === 0) return;
    if (!models.some((m) => m.id === model)) onModelChange(models[0].id);
  }, [models, model, onModelChange]);

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
      <Field label="Provider" tip={ProviderTip}>
        <select
          value={provider}
          onChange={(e) => {
            const next = e.target.value as ProviderId;
            onProviderChange(next);
            onModelChange(PROVIDERS[next].defaultModel);
          }}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
        >
          {PROVIDER_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Model" tip={<ModelTip provider={provider} model={model} />}>
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {modelDescriptor(m)}
            </option>
          ))}
          {models.length === 0 && (
            <option value="">
              {provider === "custom" ? "No models listed yet" : "No models"}
            </option>
          )}
        </select>
        <LiveNote
          provider={provider}
          count={models.filter((m) => !m.retired).length}
          status={status}
          error={error}
          onRefresh={refresh}
        />
      </Field>
      <Field
        label={
          <>
            Temperature — {temperature.toFixed(2)}
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-1.5 py-0.5">
              {temperatureRegime(temperature)}
            </span>
          </>
        }
        tip={TemperatureTip}
      >
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={temperature}
          onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
          className="w-full accent-[var(--highlight)]"
        />
      </Field>
    </div>
  );
}

function tierLabel(tier: "frontier" | "balanced" | "fast"): string {
  if (tier === "frontier") return "frontier";
  if (tier === "balanced") return "balanced (recommended)";
  return "fast";
}

function modelDescriptor(m: ModelMeta): string {
  if (m.retired) return "not listed by the API any more";
  if (m.pricingUnknown) return "listed by the API · pricing unknown";
  if (m.live) return "listed by the API";
  if (typeof m.downloadMb === "number") {
    return `${formatSize(m.downloadMb)} free${
      m.tier === "balanced" ? " · recommended" : ""
    }`;
  }
  return tierLabel(m.tier);
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
  return `${mb}MB`;
}

function Field({
  label,
  tip,
  children,
}: {
  label: React.ReactNode;
  tip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5 flex-wrap">
        {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </span>
      {children}
    </label>
  );
}


/**
 * Where the list came from. Silent for the in-browser models and for a
 * provider with no key; otherwise says whether the API has answered, so a
 * stale built-in list is never mistaken for a live one.
 */
function LiveNote({
  provider,
  count,
  status,
  error,
  onRefresh,
}: {
  provider: ProviderId;
  count: number;
  status: "static" | "loading" | "live" | "error";
  error: string | null;
  onRefresh: () => void;
}) {
  if (provider === "webllm") return null;
  if (status === "static") {
    return provider === "custom" && count === 0 ? (
      <span className="font-mono text-[10px] text-ink-quiet">
        Set the endpoint URL and key in Keys to list its models.
      </span>
    ) : null;
  }
  return (
    <span className="font-mono text-[10px] text-ink-quiet flex flex-wrap items-center gap-x-2">
      {status === "loading" && "Checking the API…"}
      {status === "live" && (
        <>
          {count} model{count === 1 ? "" : "s"} listed by the API
        </>
      )}
      {status === "error" && (
        <span className="text-highlight-ink">
          Couldn&apos;t list models ({error}) — showing the built-in list.
        </span>
      )}
      {status !== "loading" && (
        <button
          type="button"
          onClick={onRefresh}
          className="underline decoration-line underline-offset-2 hover:text-ink"
        >
          {status === "error" ? "retry" : "refresh"}
        </button>
      )}
    </span>
  );
}
