"use client";

import { useMemo, useState } from "react";
import { PROVIDERS } from "@/lib/providers";
import type { DiffTurn, DiffTurnOutput, DiffDraftConfig } from "@/lib/drafts";
import {
  diffWords,
  divergenceRatio,
  type DiffSegment,
} from "@/lib/diff-words";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";

const DIVERGENCE_THRESHOLD = 0.6;

export function TurnRow({
  num,
  turn,
  configA,
  configB,
  highlightDiff,
  label = "Turn",
  onDelete,
  onNoteChange,
}: {
  num: number;
  turn: DiffTurn;
  configA: DiffDraftConfig;
  configB: DiffDraftConfig;
  highlightDiff: boolean;
  /** Row prefix — "Turn" in conversation mode, "Run" in independent mode. */
  label?: string;
  onDelete?: () => void;
  onNoteChange: (note: string) => void;
}) {
  const canDiff =
    highlightDiff &&
    turn.outputA.status === "done" &&
    turn.outputB.status === "done" &&
    !!turn.outputA.text &&
    !!turn.outputB.text;

  const diffResult = useMemo(() => {
    if (!canDiff) return null;
    const pair = diffWords(turn.outputA.text, turn.outputB.text);
    return { pair, divergence: divergenceRatio(pair) };
  }, [canDiff, turn.outputA.text, turn.outputB.text]);

  // When outputs share little structure word-level highlights are noise —
  // most tokens light up and the signal disappears. Suppress in that case
  // and tell the user why.
  const tooDivergent =
    !!diffResult && diffResult.divergence >= DIVERGENCE_THRESHOLD;
  const segments = diffResult && !tooDivergent ? diffResult.pair : null;

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            {label} {num}
          </span>
          <p className="font-sans text-[14px] leading-[1.5] text-ink truncate min-w-0">
            {turn.userMessage || (
              <span className="italic text-ink-quiet">No prompt</span>
            )}
          </p>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger shrink-0"
          >
            Delete
          </button>
        )}
      </div>

      {turn.pinsApplied && turn.pinsApplied.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Pins active
          </span>
          {turn.pinsApplied.map((p) => (
            <span
              key={p}
              title={p}
              className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5 max-w-[200px] truncate"
            >
              &ldquo;{p}&rdquo;
            </span>
          ))}
        </div>
      )}

      {tooDivergent && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Outputs diverge too much for word-level highlights — they&apos;d
          paint almost everything.
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        <TurnOutput
          label="A"
          config={configA}
          output={turn.outputA}
          segments={segments?.left ?? null}
          userMessage={turn.userMessage}
          filenameStem={`diff-turn${num}-a`}
        />
        <TurnOutput
          label="B"
          config={configB}
          output={turn.outputB}
          segments={segments?.right ?? null}
          userMessage={turn.userMessage}
          filenameStem={`diff-turn${num}-b`}
        />
      </div>

      <NoteEditor note={turn.note} onChange={onNoteChange} />
    </div>
  );
}

function TurnOutput({
  label,
  config,
  output,
  segments,
  userMessage,
  filenameStem,
}: {
  label: string;
  config: DiffDraftConfig;
  output: DiffTurnOutput;
  segments: DiffSegment[] | null;
  userMessage: string;
  filenameStem: string;
}) {
  const modelName =
    PROVIDERS[config.provider].models.find((m) => m.id === config.model)?.name ??
    config.model;
  const elapsed =
    output.startMs && output.endMs
      ? ((output.endMs - output.startMs) / 1000).toFixed(1) + "s"
      : null;
  const [showPrompt, setShowPrompt] = useState(false);
  const hasPrompt = !!config.system.trim();
  const hasText = output.status === "done" && !!output.text;

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet shrink-0">
            {label}
          </span>
          <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5 truncate">
            {modelName}
          </span>
          <span className="font-mono text-[10px] text-ink-quiet shrink-0">
            T {config.temperature.toFixed(1)}
          </span>
          {hasPrompt && (
            <button
              type="button"
              onClick={() => setShowPrompt((v) => !v)}
              aria-expanded={showPrompt}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink shrink-0"
            >
              {showPrompt ? "Hide prompt" : "Prompt"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {hasText && (
            <ShareActions
              copyText={output.text}
              filenameStem={filenameStem}
              markdown={[
                `# Diff Mode — side ${label}`,
                "",
                `**Model:** ${modelName} · temp ${config.temperature.toFixed(1)}`,
                "",
                "## System prompt",
                "",
                "```",
                config.system,
                "```",
                "",
                "## User message",
                "",
                userMessage,
                "",
                "## Output",
                "",
                output.text,
                "",
              ].join("\n")}
            />
          )}
          <StatusDot status={output.status} />
        </div>
      </div>

      {showPrompt && hasPrompt && (
        <div className="bg-canvas border border-line rounded-[8px] p-2.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
            System prompt
          </p>
          <p className="font-mono text-[11px] leading-[1.55] text-ink whitespace-pre-wrap">
            {config.system}
          </p>
        </div>
      )}

      <div className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[80px]">
        {output.error ? (
          <span className="text-danger">{output.error}</span>
        ) : segments ? (
          segments.map((seg, i) => <Segment key={i} segment={seg} />)
        ) : output.text ? (
          <>
            {output.text}
            {output.status === "running" && (
              <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
            )}
          </>
        ) : output.status === "running" ? (
          <StreamingPlaceholder />
        ) : (
          <span className="text-ink-quiet italic">—</span>
        )}
      </div>

      {(output.status === "done" || output.status === "error") &&
        (output.inputTokens || output.outputTokens || elapsed) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            {output.inputTokens != null && (
              <span>in {output.inputTokens} tok</span>
            )}
            {output.outputTokens != null && (
              <span>out {output.outputTokens} tok</span>
            )}
            {output.costUsd != null && (
              <span className="text-ink">
                {output.costUsd < 0.01
                  ? "<$0.01"
                  : `$${output.costUsd.toFixed(3)}`}
              </span>
            )}
            {elapsed && <span>{elapsed}</span>}
          </div>
        )}
    </div>
  );
}

function Segment({ segment }: { segment: DiffSegment }) {
  if (segment.kind === "same") {
    return <span>{segment.text}</span>;
  }
  // "removed" (A-only) and "added" (B-only) both render as diff highlights —
  // the side they appear on signals whose unique text it is.
  return (
    <span className="bg-highlight-soft text-highlight-ink rounded-sm px-0.5">
      {segment.text}
    </span>
  );
}

function NoteEditor({
  note,
  onChange,
}: {
  note: string | undefined;
  onChange: (next: string) => void;
}) {
  const hasNote = !!note?.trim();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  function startEditing() {
    setDraft(note ?? "");
    setEditing(true);
  }

  function save() {
    onChange(draft.trim());
    setEditing(false);
  }

  function cancel() {
    setDraft(note ?? "");
    setEditing(false);
  }

  function clear() {
    onChange("");
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-4 pt-4 border-t border-line flex flex-col gap-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Note
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="What did you learn from this turn?"
          autoFocus
          className="w-full bg-canvas border border-line rounded-[8px] px-3 py-2 font-sans text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Save note
          </button>
          <button
            type="button"
            onClick={cancel}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          {hasNote && (
            <button
              type="button"
              onClick={clear}
              className="ml-auto font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger"
            >
              Clear note
            </button>
          )}
        </div>
      </div>
    );
  }

  if (hasNote) {
    return (
      <div className="mt-4 pt-4 border-t border-line">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Note
          </span>
          <button
            type="button"
            onClick={startEditing}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Edit
          </button>
        </div>
        <p className="font-sans text-[14px] leading-[1.55] text-ink mt-1 whitespace-pre-wrap">
          {note}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-line">
      <button
        type="button"
        onClick={startEditing}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        + Add note
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: DiffTurnOutput["status"] }) {
  const color =
    status === "running"
      ? "bg-highlight animate-pulse"
      : status === "done"
      ? "bg-success"
      : "bg-danger";
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full shrink-0 ${color}`}
      aria-label={status}
    />
  );
}
