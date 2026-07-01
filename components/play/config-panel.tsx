"use client";

import { PROVIDER_LIST, ProviderId, PROVIDERS } from "@/lib/providers";
import { InfoTip } from "@/components/info-tip";
import {
  ModelTip,
  ProviderTip,
  SystemPromptTip,
  TemperatureTip,
  temperatureRegime,
} from "@/components/play/config-help";

export type ConfigState = {
  provider: ProviderId;
  model: string;
  system: string;
  temperature: number;
};

export function ConfigPanel({
  label,
  config,
  onChange,
  connected,
}: {
  label: string;
  config: ConfigState;
  onChange: (next: ConfigState) => void;
  connected: boolean;
}) {
  const provider = PROVIDERS[config.provider];

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {label}
        </div>
        <div
          className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1 ${
            connected ? "text-success" : "text-danger"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-success" : "bg-danger"
            }`}
          />
          {connected ? "Key set" : "No key"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Provider" tip={ProviderTip}>
          <select
            value={config.provider}
            onChange={(e) => {
              const next = e.target.value as ProviderId;
              onChange({
                ...config,
                provider: next,
                model: PROVIDERS[next].defaultModel,
              });
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
          tip={<ModelTip provider={config.provider} model={config.model} />}
        >
          <select
            value={config.model}
            onChange={(e) => onChange({ ...config, model: e.target.value })}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {provider.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="System prompt" tip={SystemPromptTip}>
        <textarea
          value={config.system}
          onChange={(e) => onChange({ ...config, system: e.target.value })}
          rows={5}
          placeholder="You are a thoughtful assistant…"
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
      </Field>

      <Field
        label={
          <>
            Temperature — {config.temperature.toFixed(2)}
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-1.5 py-0.5">
              {temperatureRegime(config.temperature)}
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
          value={config.temperature}
          onChange={(e) =>
            onChange({ ...config, temperature: parseFloat(e.target.value) })
          }
          className="w-full accent-[var(--highlight)]"
        />
      </Field>
    </div>
  );
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
