"use client";

import { PROVIDER_LIST, PROVIDERS } from "@/lib/providers";
import type { LabModel } from "@/lib/experiment";

/** Shared form atoms for the lab. Classes follow the playgrounds' panels. */

export const INPUT =
  "w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none disabled:opacity-60";
export const MONO_INPUT =
  "w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y disabled:opacity-60";
export const PANEL = "bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-4";
export const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet";
export const LINK_BUTTON =
  "font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed";

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className={`${EYEBROW} mb-1.5 inline-flex items-center gap-1.5`}>
      {children}
    </label>
  );
}

export function PanelHeader({
  num,
  title,
  hint,
  action,
}: {
  num: string;
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className={EYEBROW}>{num}</p>
        <h2 className="font-display text-[24px] md:text-[28px] leading-[1.15] text-ink mt-1">{title}</h2>
        {hint && <p className="font-sans text-[13px] leading-[1.55] text-ink-muted mt-1 max-w-2xl">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

const SEP = "::";

/**
 * One select over every catalog model, grouped by provider — for picking a
 * judge without a second provider/model row. The current value is always
 * listed, even when it isn't in the static catalog (live or custom models).
 */
export function ModelRefSelect({
  value,
  onChange,
  ariaLabel,
  disabled,
}: {
  value: LabModel;
  onChange: (next: LabModel) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const current = `${value.provider}${SEP}${value.model}`;
  const inCatalog = PROVIDERS[value.provider]?.models.some((m) => m.id === value.model);
  return (
    <select
      aria-label={ariaLabel}
      disabled={disabled}
      value={current}
      onChange={(e) => {
        const [provider, ...rest] = e.target.value.split(SEP);
        onChange({ provider: provider as LabModel["provider"], model: rest.join(SEP) });
      }}
      className={`${INPUT} font-mono text-[12px]`}
    >
      {!inCatalog && <option value={current}>{value.model}</option>}
      {PROVIDER_LIST.map((p) => (
        <optgroup key={p.id} label={p.name}>
          {p.models
            .filter((m) => !m.retired)
            .map((m) => (
              <option key={m.id} value={`${p.id}${SEP}${m.id}`}>
                {m.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
