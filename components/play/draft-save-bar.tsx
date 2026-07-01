"use client";

import Link from "next/link";

export type DraftSaveStatus = "idle" | "saving" | "saved";

export function DraftSaveBar({
  title,
  onTitleChange,
  status,
  draftId,
  onSave,
  disabled,
  artifact,
}: {
  title: string;
  onTitleChange: (next: string) => void;
  status: DraftSaveStatus;
  /** Truthy once the draft has been persisted at least once in this session. */
  draftId: string | null;
  onSave: () => void;
  disabled?: boolean;
  /** The artifact this playground produces (e.g. "Persona Card") — names the
   *  thing being saved, matching the promise on the /play cards. */
  artifact?: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Draft title
          {artifact && (
            <>
              {" · "}
              <span className="text-ink-muted">Saves as {artifact}</span>
            </>
          )}
        </label>
        <div className="flex items-center gap-3">
          {status === "saved" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Saved
            </span>
          )}
          {draftId && status !== "saved" && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Editing draft
            </span>
          )}
          <Link
            href="/notebook"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Notebook →
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled draft"
          className="flex-1 min-w-[200px] bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || status === "saving"}
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {status === "saving"
            ? "Saving…"
            : draftId
            ? "Save changes"
            : "Save draft"}
        </button>
      </div>
      {!draftId && (
        <p className="font-mono text-[10px] text-ink-quiet leading-[1.5]">
          Saves to this browser — private, no account. Export to JSON or PDF
          from the Notebook to take it elsewhere.
        </p>
      )}
    </div>
  );
}
