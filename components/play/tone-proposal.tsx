"use client";

import { useState } from "react";
import {
  TONE_DIMENSIONS,
  TONE_INITIAL,
  proposalChanges,
  readTargetSignals,
  sameTone,
  stopLabel,
  type InferredTone,
  type ToneValues,
} from "@/lib/tone";
import { diffWords, divergenceRatio } from "@/lib/diff-words";
import { InfoTip } from "@/components/info-tip";
import { StreamingPlaceholder } from "./streaming-placeholder";

export type InferenceState = {
  status: "idle" | "running" | "done" | "error";
  raw: string;
  result: InferredTone | null;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

export const EMPTY_INFERENCE: InferenceState = {
  status: "idle",
  raw: "",
  result: null,
};

/**
 * What a rule can read off the target without a model. Shown beside the
 * proposal so the reader can see which dials the model could have counted
 * (length, structure) and which it had to judge (warmth, energy).
 */
export function TargetSignals({ target }: { target: string }) {
  const signals = readTargetSignals(target);
  if (signals.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mr-1 inline-flex items-center gap-1">
        Read off the target
        <InfoTip>
          The mechanical facts — counted, not judged. Length and structure a
          rule can read; warmth and energy it can&apos;t. Compare these with
          what the model proposes for the same dials.
        </InfoTip>
      </span>
      {signals.map((s) => (
        <span
          key={s.dim}
          className="inline-flex items-center gap-1 font-mono text-[10px] rounded-full px-2 py-0.5 bg-line/60 text-ink-muted"
        >
          <span className="text-ink-quiet">{TONE_INITIAL[s.dim]}</span>
          {s.label}
        </span>
      ))}
    </div>
  );
}

/**
 * The model's read of the target, as a diff against the current dials.
 *
 * A proposal, never a setting: nothing moves until the designer applies it,
 * and every line carries the model's one-sentence reason so the designer can
 * disagree with a specific dial rather than with the whole guess.
 */
export function ProposalCard({
  inference,
  current,
  onApply,
  modelName,
}: {
  inference: InferenceState;
  current: ToneValues;
  onApply: (values: ToneValues) => void;
  modelName: string;
}) {
  const [showRaw, setShowRaw] = useState(false);
  const result = inference.result;
  const changes = result ? proposalChanges(current, result.values) : [];
  const applied = !!result && sameTone(current, result.values);

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[200px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
          Proposal
          <InfoTip>
            The dial positions the model thinks would produce the target.
            It is a guess about six instructions, made by reading one reply —
            apply it, then run it forward and see whether the result reads
            like the target.
          </InfoTip>
        </span>
        <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
          {modelName}
        </span>
      </div>

      {inference.status === "idle" && (
        <p className="font-mono text-[11px] text-ink-quiet">
          Edit the target, then infer the dials. The model proposes; you
          decide.
        </p>
      )}

      {inference.status === "running" && (
        <div className="font-mono text-[12px] text-ink">
          <StreamingPlaceholder />
          <p className="mt-2 text-[11px] text-ink-quiet">Reading the target…</p>
        </div>
      )}

      {inference.status === "error" && (
        <p className="font-mono text-[12px] text-danger">{inference.error}</p>
      )}

      {inference.status === "done" && !result && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-[12px] text-ink">
            <span className="text-highlight-ink">No clear proposal.</span>{" "}
            The reply didn&apos;t contain dial values. Small models miss the
            format sometimes; that is a finding about the model, not about
            your target.
          </p>
          <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[200px] overflow-y-auto text-ink-muted">
            {inference.raw || "(empty reply)"}
          </pre>
        </div>
      )}

      {inference.status === "done" && result && (
        <>
          <div className="flex flex-col gap-2">
            {TONE_DIMENSIONS.map((dim) => {
              const from = current[dim.id];
              const to = result.values[dim.id];
              const moves = from !== to;
              return (
                <div
                  key={dim.id}
                  className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span
                      className={`inline-block font-mono text-[10px] font-medium leading-none w-5 h-5 rounded-full text-center pt-1 shrink-0 ${
                        to === 0 ? "bg-line/60 text-ink-quiet" : "bg-ink text-canvas"
                      }`}
                      aria-hidden
                    >
                      {TONE_INITIAL[dim.id]}
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink w-[104px]">
                      {dim.label}
                    </span>
                    {moves ? (
                      <span className="font-mono text-[11px] text-ink">
                        <span className="text-ink-quiet">
                          {stopLabel(dim.id, from)}
                        </span>{" "}
                        <span className="text-highlight">→</span>{" "}
                        <span className="text-highlight-ink">
                          {stopLabel(dim.id, to)}
                        </span>
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-ink-quiet">
                        {stopLabel(dim.id, to)} · unchanged
                      </span>
                    )}
                  </div>
                  {result.why[dim.id] && (
                    <p className="font-sans text-[12px] leading-[1.5] text-ink-muted pl-7">
                      {result.why[dim.id]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => onApply(result.values)}
              disabled={applied}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[13px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {applied
                ? "Applied"
                : changes.length === 0
                  ? "Matches your dials"
                  : `Apply — move ${changes.length} dial${changes.length === 1 ? "" : "s"}`}
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {inference.inputTokens != null && (
                <>
                  {(inference.inputTokens ?? 0) + (inference.outputTokens ?? 0)}{" "}
                  tok
                  {inference.costUsd != null && inference.costUsd > 0 && (
                    <>
                      {" · "}
                      {inference.costUsd < 0.01
                        ? "<$0.01"
                        : `$${inference.costUsd.toFixed(3)}`}
                    </>
                  )}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="ml-auto font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              {showRaw ? "Hide" : "Raw reply"}
            </button>
          </div>
          {showRaw && (
            <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[240px] overflow-y-auto text-ink-muted">
              {inference.raw}
            </pre>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The check. Run the proposal forward and put the result beside the target.
 * The word-level diff is a crude read — two replies can differ in every word
 * and share a tone — so the number is labelled as such and the judgement is
 * left to the reader.
 */
export function TargetComparison({
  target,
  output,
}: {
  target: string;
  output: string;
}) {
  const pair = diffWords(target, output);
  const ratio = Math.round(divergenceRatio(pair) * 100);
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Target vs. what the dials produced
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          differs in {ratio}% of words · a crude read
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Column label="Target — what you wanted" segments={pair.left} tone="removed" />
        <Column label="Output — what the dials produced" segments={pair.right} tone="added" />
      </div>
      <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
        Word overlap says nothing about tone — two replies can share no words
        and the same voice. Read both. If the output has the target&apos;s
        tone, the dials are the spec; if not, the dial the model got wrong is
        the one to move by hand.
      </p>
    </div>
  );
}

function Column({
  label,
  segments,
  tone,
}: {
  label: string;
  segments: { kind: "same" | "removed" | "added"; text: string }[];
  tone: "removed" | "added";
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {label}
      </span>
      <p className="font-sans text-[14px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
        {segments.map((seg, i) =>
          seg.kind === "same" ? (
            <span key={i}>{seg.text}</span>
          ) : (
            <mark
              key={i}
              className={`rounded-[3px] px-0.5 ${
                tone === "removed"
                  ? "bg-line/80 text-ink-muted"
                  : "bg-highlight-soft text-highlight-ink"
              }`}
            >
              {seg.text}
            </mark>
          ),
        )}
      </p>
    </div>
  );
}
