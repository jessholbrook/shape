"use client";

import { useState } from "react";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";
import {
  SOURCE_KIND_LABEL,
  composeUserTurn,
  echoed,
  type SetRow,
  type SetRun,
  type Source,
} from "@/lib/context-lab";

/**
 * One context set: which sources are switched on, what the model actually
 * receives, and what came back.
 *
 * The "what the model reads" disclosure is doing real teaching work. A reader
 * who has only ever edited a system prompt tends to picture that prompt as the
 * input; seeing their four-line instruction sitting above six paragraphs of
 * retrieved text is the fastest way to correct that.
 */
export function ContextSetCard({
  row,
  allSources,
  question,
  system,
  onToggleSource,
  onRename,
  onRemove,
  canRemove,
}: {
  row: SetRow;
  allSources: Source[];
  question: string;
  system: string;
  onToggleSource: (sourceId: string) => void;
  onRename: (label: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const assembled = composeUserTurn(row.sources, question);
  const systemChars = system.length;
  const totalChars = systemChars + assembled.length;
  const systemShare =
    totalChars === 0 ? 0 : Math.round((systemChars / totalChars) * 100);

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Editable, because the label is what identifies this row in the
            report — an unnamed set makes the verdict list unreadable. */}
        <input
          type="text"
          value={row.set.label}
          onChange={(e) => onRename(e.target.value)}
          placeholder="Set name"
          aria-label="Context set name"
          className="flex-1 min-w-[120px] bg-transparent border border-transparent hover:border-line focus:border-ink rounded-[8px] px-2 py-1 -ml-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink focus:outline-none"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet shrink-0">
          {row.sources.length} source{row.sources.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${row.set.label || "set"}`}
          className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-full text-[16px] leading-none text-ink-quiet hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ×
        </button>
      </div>

      {/* Source toggles — the set is defined by what's switched on. */}
      <div className="flex flex-wrap gap-1.5">
        {allSources.map((s) => {
          const on = row.set.sourceIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggleSource(s.id)}
              title={`${SOURCE_KIND_LABEL[s.kind]} — ${s.label}`}
              className={`font-mono text-[10px] rounded-full px-2 py-0.5 border transition-colors max-w-[180px] truncate ${
                on
                  ? s.kind === "trusted"
                    ? "border-success/50 text-success bg-success/10"
                    : s.kind === "stale"
                    ? "border-highlight/50 text-highlight-ink bg-highlight-soft"
                    : "border-danger/50 text-danger bg-danger/10"
                  : "border-line text-ink-quiet hover:border-ink-quiet"
              }`}
            >
              {on ? "✓ " : "+ "}
              {s.label}
            </button>
          );
        })}
        {allSources.length === 0 && (
          <span className="font-mono text-[10px] text-ink-quiet">
            No sources defined yet.
          </span>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowPrompt((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          {showPrompt ? "Hide" : "What the model reads"} ·{" "}
          <span className="text-ink-quiet">
            system prompt is {systemShare}% of it
          </span>
        </button>
        {showPrompt && (
          <div className="mt-2 flex flex-col gap-2">
            <Block label="System" text={system} muted />
            <Block label="User turn" text={assembled} />
          </div>
        )}
      </div>

      <div className="border-t border-line pt-3 flex flex-col gap-3">
        {row.runsScored === 0 && (
          <p className="font-mono text-[11px] text-ink-quiet italic min-h-[48px]">
            Not run yet.
          </p>
        )}
        {(row.runs ?? []).map((run, i) => (
          <RunBody
            key={i}
            run={run}
            index={i}
            showIndex={(row.runs ?? []).length > 1}
            sources={row.sources}
            setLabel={row.set.label}
          />
        ))}
      </div>
    </div>
  );
}

function RunBody({
  run,
  index,
  showIndex,
  sources,
  setLabel,
}: {
  run: SetRun;
  index: number;
  showIndex: boolean;
  sources: Source[];
  setLabel: string;
}) {
  const hits =
    run.status === "done" ? sources.filter((s) => echoed(s, run.text)) : [];
  return (
    <div className="flex flex-col gap-2">
      {(showIndex || (run.status === "done" && !!run.text)) && (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
            {showIndex ? `Run ${index + 1}` : "Output"}
          </span>
          {run.status === "done" && !!run.text && (
            <ShareActions
              copyText={run.text}
              filenameStem={`context-${setLabel
                .toLowerCase()
                .replace(/\s+/g, "-")}-${index + 1}`}
              markdown={`# Shape — Context Lab, ${setLabel}\n\n${run.text}\n`}
            />
          )}
        </div>
      )}
      <div className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[48px]">
        {run.error ? (
          <span className="text-danger">{run.error}</span>
        ) : run.text ? (
          <>
            {run.text}
            {run.status === "running" && (
              <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
            )}
          </>
        ) : run.status === "running" ? (
          <StreamingPlaceholder />
        ) : (
          <span className="text-ink-quiet italic">Waiting…</span>
        )}
      </div>
      {hits.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hits.map((s) => (
            <span
              key={s.id}
              title={`Echoed "${s.tell}" from ${s.label}`}
              className={`font-mono text-[9px] rounded-full px-2 py-0.5 border ${
                s.kind === "trusted"
                  ? "border-success/40 text-success"
                  : s.kind === "stale"
                  ? "border-highlight/50 text-highlight-ink"
                  : "border-danger/40 text-danger"
              }`}
            >
              echoed {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Block({
  label,
  text,
  muted,
}: {
  label: string;
  text: string;
  muted?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet mb-1">
        {label} · {text.length} chars
      </p>
      <pre
        className={`font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[220px] overflow-y-auto ${
          muted ? "text-ink-muted" : "text-ink"
        }`}
      >
        {text}
      </pre>
    </div>
  );
}
