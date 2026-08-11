"use client";

import {
  SOURCE_KIND_BLURB,
  SOURCE_KIND_LABEL,
  type Source,
  type SourceKind,
} from "@/lib/context-lab";
import { InfoTip } from "@/components/info-tip";

const KINDS: SourceKind[] = ["trusted", "stale", "untrusted"];

/**
 * One document the model might be handed. The `kind` isn't decoration — it's
 * what turns an echo into a verdict, because "the answer repeated this" only
 * matters once you've said whether you stand behind it.
 */
export function SourceEditor({
  source,
  onChange,
  onRemove,
  canRemove,
}: {
  source: Source;
  onChange: (next: Source) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="bg-canvas border border-line rounded-[12px] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={source.label}
          onChange={(e) => onChange({ ...source, label: e.target.value })}
          placeholder="Source name"
          aria-label="Source name"
          className="flex-1 min-w-[160px] bg-surface border border-line rounded-[8px] px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
        />
        <select
          value={source.kind}
          onChange={(e) =>
            onChange({ ...source, kind: e.target.value as SourceKind })
          }
          aria-label="Source trust level"
          className={`bg-surface border rounded-[8px] px-2 py-1.5 font-mono text-[11px] focus:outline-none ${
            source.kind === "trusted"
              ? "border-success/50 text-success"
              : source.kind === "stale"
              ? "border-highlight/50 text-highlight-ink"
              : "border-danger/50 text-danger"
          }`}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {SOURCE_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <InfoTip>{SOURCE_KIND_BLURB[source.kind]}</InfoTip>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${source.label || "source"}`}
          className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-[18px] leading-none text-ink-quiet hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ×
        </button>
      </div>

      <textarea
        value={source.body}
        onChange={(e) => onChange({ ...source, body: e.target.value })}
        rows={3}
        placeholder="What this document says…"
        aria-label="Source body"
        className="w-full bg-surface border border-line rounded-[8px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
      />

      <label className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
          Tell
          <InfoTip>
            A phrase that shows up in the answer only if the model leaned on
            this source. It&apos;s how an answer gets attributed — without one,
            a source can be in the context and never be traceable.
          </InfoTip>
        </span>
        <input
          type="text"
          value={source.tell}
          onChange={(e) => onChange({ ...source, tell: e.target.value })}
          placeholder="e.g. 30 days"
          aria-label="Source tell"
          className="flex-1 min-w-[140px] bg-surface border border-line rounded-[8px] px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
        />
      </label>
    </div>
  );
}
