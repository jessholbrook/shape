"use client";

import { useState } from "react";
import type { ChoreographedTurn, AssistantResult } from "@/lib/choreographer";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";

export function ChoreographerTurnRow({
  num,
  turn,
  onUserMessageChange,
  onNoteChange,
  onDelete,
  canDelete,
}: {
  num: number;
  turn: ChoreographedTurn;
  onUserMessageChange: (next: string) => void;
  onNoteChange: (next: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const elapsed =
    turn.assistant.startMs && turn.assistant.endMs
      ? ((turn.assistant.endMs - turn.assistant.startMs) / 1000).toFixed(1) +
        "s"
      : null;

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Turn {num}
        </span>
        <div className="flex items-center gap-3">
          <StatusDot status={turn.assistant.status} />
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* User turn (editable) */}
      <div className="mt-4">
        <label className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet block mb-1">
          User
        </label>
        <textarea
          value={turn.userMessage}
          onChange={(e) => onUserMessageChange(e.target.value)}
          rows={2}
          placeholder="What does the user say next?"
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
      </div>

      {/* Assistant response */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Assistant
          </p>
          {turn.assistant.status === "done" && !!turn.assistant.text && (
            <div className="flex items-center gap-3">
              <ShareActions
                copyText={turn.assistant.text}
                filenameStem={`choreographer-turn${num}`}
                markdown={[
                  `# Conversation Choreographer — turn ${num}`,
                  "",
                  "## User",
                  "",
                  turn.userMessage,
                  "",
                  "## Assistant",
                  "",
                  turn.assistant.text,
                  "",
                  ...(turn.assistant.note?.trim()
                    ? ["## Note", "", turn.assistant.note.trim(), ""]
                    : []),
                ].join("\n")}
              />
            </div>
          )}
        </div>
        <div className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[60px]">
          {turn.assistant.error ? (
            <span className="text-danger">{turn.assistant.error}</span>
          ) : turn.assistant.text ? (
            <>
              {turn.assistant.text}
              {turn.assistant.status === "running" && (
                <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
              )}
            </>
          ) : turn.assistant.status === "running" ? (
            <StreamingPlaceholder />
          ) : (
            <span className="text-ink-quiet italic">Not run yet.</span>
          )}
        </div>
        {(turn.assistant.status === "done" ||
          turn.assistant.status === "error") &&
          (turn.assistant.inputTokens ||
            turn.assistant.outputTokens ||
            elapsed) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {turn.assistant.inputTokens != null && (
                <span>in {turn.assistant.inputTokens} tok</span>
              )}
              {turn.assistant.outputTokens != null && (
                <span>out {turn.assistant.outputTokens} tok</span>
              )}
              {turn.assistant.costUsd != null && (
                <span className="text-ink">
                  {turn.assistant.costUsd < 0.01
                    ? "<$0.01"
                    : `$${turn.assistant.costUsd.toFixed(3)}`}
                </span>
              )}
              {elapsed && <span>{elapsed}</span>}
            </div>
          )}
      </div>

      <NoteEditor note={turn.assistant.note} onChange={onNoteChange} />
    </div>
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
          autoFocus
          placeholder="How did the model handle this turn?"
          className="w-full bg-canvas border border-line rounded-[8px] px-3 py-2 font-sans text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              onChange(draft.trim());
              setEditing(false);
            }}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Save note
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(note ?? "");
              setEditing(false);
            }}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
          {hasNote && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setEditing(false);
              }}
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
            onClick={() => {
              setDraft(note ?? "");
              setEditing(true);
            }}
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
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        + Add note
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: AssistantResult["status"] }) {
  if (status === "idle") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Idle
      </span>
    );
  }
  const color =
    status === "running"
      ? "bg-highlight animate-pulse"
      : status === "done"
      ? "bg-success"
      : "bg-danger";
  const label =
    status === "running" ? "Streaming" : status === "done" ? "Done" : "Error";
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
