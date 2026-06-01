"use client";

import {
  PROVIDER_LIST,
  PROVIDERS,
  getModel,
  type ModelMeta,
  type ProviderId,
} from "@/lib/providers";
import { InfoTip } from "@/components/info-tip";

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
  const selectedModel = getModel(provider, model);
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
      <Field
        label="Provider"
        tip={
          <>
            <strong>Free (in browser)</strong> runs small open models via WebGPU
            — no key, no server. <strong>Anthropic</strong> + <strong>OpenAI</strong>{" "}
            need a key but unlock bigger models. First webllm run downloads the
            model once (~280MB to 2GB depending on choice).
          </>
        }
      >
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
      <Field
        label="Model"
        tip={
          provider === "webllm" ? (
            <>
              Each model is downloaded once and cached. Bigger = better quality
              but a slower first run.{" "}
              <strong>{selectedModel?.name ?? model}</strong>
              {selectedModel?.blurb && <> — {selectedModel.blurb}</>}.
            </>
          ) : (
            <>
              <strong>Frontier</strong> = top quality, slow, pricier.{" "}
              <strong>Balanced</strong> = good quality, fast, recommended for
              most playgrounds. <strong>Fast</strong> = cheap and quick.
              Selected: <em>{selectedModel?.name ?? model}</em>.
            </>
          )
        }
      >
        <select
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
        >
          {PROVIDERS[provider].models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {modelDescriptor(m)}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={`Temperature — ${temperature.toFixed(2)}`}
        tip={
          <>
            How much variation in the output. <strong>0</strong> = same answer
            every time, useful for tests and rubrics. <strong>0.7</strong> =
            creative but coherent, good default. <strong>1.0</strong> = loose
            and surprising, sometimes incoherent.
          </>
        }
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
  label: string;
  tip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
        {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </span>
      {children}
    </label>
  );
}
