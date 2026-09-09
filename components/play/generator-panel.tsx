"use client";

import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import { GENERATED_COUNT, GENERATION_TEMPERATURE, type GeneratedSet } from "@/lib/evals";
import { ModelSelect } from "./model-select";
import { InfoTip } from "@/components/info-tip";

/**
 * The reader's own set: a brief, a request, and a model to write four replies
 * at temperature 1. Nothing here asks for variety or quality on purpose —
 * four honest samples are the point, and ranking them is the reader's job.
 */
export function GeneratorPanel({
  set,
  onChange,
  hasKey,
  running,
  onGenerate,
}: {
  set: GeneratedSet;
  onChange: (next: GeneratedSet) => void;
  hasKey: boolean;
  running: boolean;
  onGenerate: () => void;
}) {
  const written = set.outputs.filter((o) => o.status === "done").length;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
            The surface
            <InfoTip>
              Where this copy appears and what just happened. It becomes the
              writer&apos;s system prompt, so write it the way you&apos;d brief a
              colleague.
            </InfoTip>
          </span>
          <textarea
            value={set.brief}
            disabled={running}
            onChange={(e) => onChange({ ...set, brief: e.target.value })}
            rows={3}
            aria-label="The surface"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[13px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            The request
          </span>
          <textarea
            value={set.userMessage}
            disabled={running}
            onChange={(e) => onChange({ ...set, userMessage: e.target.value })}
            rows={3}
            aria-label="The request"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[13px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y disabled:opacity-60"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink w-16 shrink-0">
          Writer
        </span>
        <select
          value={set.provider}
          disabled={running}
          onChange={(e) => {
            const next = e.target.value as ProviderId;
            onChange({ ...set, provider: next, model: PROVIDERS[next].defaultModel });
          }}
          aria-label="Writer provider"
          className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
        >
          {PROVIDER_LIST.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <ModelSelect
          provider={set.provider}
          model={set.model}
          onChange={(model) => onChange({ ...set, model })}
          ariaLabel="Writer model"
          className="flex-1 min-w-[180px] bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
        />
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1 w-16 shrink-0 ${
            hasKey ? "text-success" : "text-danger"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${hasKey ? "bg-success" : "bg-danger"}`} />
          {hasKey ? "Key" : "No key"}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!hasKey || running || !set.userMessage.trim()}
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running
            ? "Writing…"
            : written > 0
              ? `Write ${GENERATED_COUNT} new replies`
              : `Write ${GENERATED_COUNT} replies`}
          <span className="text-highlight">→</span>
        </button>
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet max-w-sm">
          {GENERATED_COUNT} independent replies at temperature {GENERATION_TEMPERATURE} —
          the model&apos;s spread, not its best attempt. Rank them before you
          write a criterion; your ranking is what the rubric is checked against.
        </p>
      </div>
    </div>
  );
}
