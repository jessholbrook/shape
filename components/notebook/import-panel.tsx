"use client";

import { useState } from "react";
import { importDraftJson, type Draft } from "@/lib/drafts";

type State =
  | { status: "idle" }
  | { status: "error"; reason: string }
  | { status: "success"; draft: Draft };

export function ImportPanel({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (draft: Draft) => void;
}) {
  const [paste, setPaste] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  function handleSubmit(json: string) {
    const result = importDraftJson(json);
    if (result.ok) {
      setState({ status: "success", draft: result.draft });
      onImported(result.draft);
    } else {
      setState({ status: "error", reason: result.reason });
    }
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      handleSubmit(text);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Could not read file.";
      setState({ status: "error", reason });
    }
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
            Import a draft
          </p>
          <p className="font-mono text-[11px] text-ink-quiet mt-1">
            Load a <span className="text-ink-muted">.shape.json</span> file or
            paste the JSON below.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 bg-canvas border border-line rounded-[10px] px-4 py-2 cursor-pointer hover:border-ink-muted transition-colors">
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink">
            Choose file
          </span>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
        </label>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          or paste below
        </span>
      </div>

      <div>
        <textarea
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value);
            if (state.status !== "idle") setState({ status: "idle" });
          }}
          rows={5}
          placeholder='{ "$schema": "shape.draft.v1", "exportedAt": "…", "draft": { … } }'
          spellCheck={false}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSubmit(paste)}
            disabled={!paste.trim()}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            Import draft
            <span className="text-highlight">→</span>
          </button>
          {state.status === "error" && (
            <span className="font-mono text-[11px] text-danger">
              {state.reason}
            </span>
          )}
          {state.status === "success" && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Imported &ldquo;{state.draft.title}&rdquo;
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
