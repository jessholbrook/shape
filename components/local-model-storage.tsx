"use client";

import { useCallback, useEffect, useState } from "react";
import { resetEngineSingleton } from "@/lib/webllm-engine";
import {
  clearLocalModelStorage,
  formatBytes,
  getOriginStorageUsage,
} from "@/lib/webllm-storage";

type ClearState =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "clearing" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/**
 * Storage panel that answers the beta-tester question: "what did the free
 * option just put on my disk, and how do I get rid of it?" Shown on both
 * /start (inside the Free card) and /settings/keys (as its own section).
 *
 * The size is a whole-origin estimate from `navigator.storage.estimate`,
 * not a model-specific number — but the model dominates by orders of
 * magnitude, so the figure is honest enough for the question being asked.
 */
export function LocalModelStorage() {
  const [usage, setUsage] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<ClearState>({ kind: "idle" });

  const refresh = useCallback(async () => {
    const bytes = await getOriginStorageUsage();
    setUsage(bytes);
  }, []);

  useEffect(() => {
    setHydrated(true);
    refresh();
  }, [refresh]);

  async function handleClear() {
    setState({ kind: "clearing" });
    try {
      await resetEngineSingleton();
      await clearLocalModelStorage();
      await refresh();
      setState({ kind: "done" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ kind: "error", message });
    }
  }

  const noUsageInfo = hydrated && usage === null;
  const empty = hydrated && usage !== null && usage < 5 * 1024 * 1024;

  return (
    <div className="bg-surface border border-line rounded-[12px] p-4 md:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          In-browser storage
        </p>
        {hydrated && usage !== null && (
          <p className="font-mono text-[12px] text-ink-muted">
            <span className="text-ink font-medium">{formatBytes(usage)}</span>{" "}
            on this origin
          </p>
        )}
      </div>

      <p className="font-sans text-[13px] leading-[1.55] text-ink-muted max-w-xl">
        {empty
          ? "Nothing significant cached for this site yet. The Free option will download a model the first time you open a playground — you can clear it from here any time."
          : noUsageInfo
          ? "Your browser doesn't report storage usage. You can still clear the in-browser model below."
          : "Includes the in-browser model (the big chunk) plus a small amount for your drafts and settings. Clearing wipes the model, not your keys or drafts."}
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        {state.kind === "confirming" ? (
          <>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 bg-danger text-canvas rounded-[10px] px-4 py-2 font-sans text-[13px] hover:bg-danger/90 transition-colors"
            >
              Yes — clear it
            </button>
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              Cancel
            </button>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Next playground run will redownload (~1 GB)
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setState({ kind: "confirming" })}
              disabled={!hydrated || state.kind === "clearing"}
              className="inline-flex items-center gap-2 border border-line bg-canvas rounded-[10px] px-4 py-2 font-sans text-[13px] text-ink hover:border-ink-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {state.kind === "clearing" ? "Clearing…" : "Clear local model"}
            </button>
            {state.kind === "done" && (
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Cleared
              </span>
            )}
            {state.kind === "error" && (
              <span
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-danger"
                title={state.message}
              >
                Couldn&apos;t clear — {state.message.slice(0, 80)}
              </span>
            )}
          </>
        )}
      </div>

      <p className="font-mono text-[10px] text-ink-quiet">
        Doesn&apos;t touch your saved API keys or notebook drafts.
      </p>
    </div>
  );
}
