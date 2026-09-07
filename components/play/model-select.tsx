"use client";

import { useEffect } from "react";
import type { ModelMeta, ProviderId } from "@/lib/providers";
import { useLiveModels } from "@/lib/hooks/use-live-models";

/**
 * A model picker fed by the live list: the static catalog until the API has
 * answered, the merged list after. Used wherever several pickers sit in one
 * component (Diff Mode's two configs, Portability's roster), where a hook
 * per row has to live in its own component.
 */
export function ModelSelect({
  provider,
  model,
  onChange,
  className,
  ariaLabel,
}: {
  provider: ProviderId;
  model: string;
  onChange: (next: string) => void;
  className: string;
  ariaLabel?: string;
}) {
  const { models } = useLiveModels(provider, model);

  // A provider with no static catalog (the custom endpoint) starts with no
  // model; adopt the first one the API lists.
  useEffect(() => {
    if (models.length === 0) return;
    if (!models.some((m) => m.id === model)) onChange(models[0].id);
  }, [models, model, onChange]);

  return (
    <select
      value={model}
      onChange={(e) => onChange(e.target.value)}
      aria-label={ariaLabel}
      className={className}
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {label(m)}
        </option>
      ))}
      {models.length === 0 && (
        <option value="">
          {provider === "custom" ? "No models listed yet" : "No models"}
        </option>
      )}
    </select>
  );
}

function label(m: ModelMeta): string {
  if (m.retired) return `${m.name} — not listed by the API any more`;
  if (m.pricingUnknown) return `${m.name} — pricing unknown`;
  if (m.live) return `${m.name} — listed by the API`;
  return m.name;
}
