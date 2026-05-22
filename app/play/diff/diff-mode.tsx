"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import {
  getDraft,
  saveDraft,
  suggestTitle,
  type DiffTurn,
  type DiffTurnOutput,
} from "@/lib/drafts";
import { ConfigPanel, type ConfigState } from "@/components/play/config-panel";
import { TurnRow } from "@/components/play/turn-row";
import {
  DraftSaveBar,
  type DraftSaveStatus,
} from "@/components/play/draft-save-bar";

const INITIAL_A: ConfigState = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  system: "You are a thoughtful UX writer. Be warm and concise.",
  temperature: 0.7,
};

const INITIAL_B: ConfigState = {
  provider: "openai",
  model: "gpt-4o",
  system: "You are a thoughtful UX writer. Be warm and concise.",
  temperature: 0.7,
};

const DEFAULT_MESSAGE =
  "Write a one-sentence welcome message for a research interview tool.";

function newTurnId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function DiffMode() {
  const { keys, hydrated } = useKeys();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [configA, setConfigA] = useState<ConfigState>(INITIAL_A);
  const [configB, setConfigB] = useState<ConfigState>(INITIAL_B);
  const [pendingMessage, setPendingMessage] = useState(DEFAULT_MESSAGE);
  const [turns, setTurns] = useState<DiffTurn[]>([]);
  const [running, setRunning] = useState(false);
  const [highlightDiff, setHighlightDiff] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialDraftId || hydratedDraftIdRef.current === initialDraftId) {
      return;
    }
    const draft = getDraft(initialDraftId);
    if (draft && draft.kind === "diff") {
      setConfigA(draft.configA);
      setConfigB(draft.configB);
      setTurns(draft.turns);
      setTitle(draft.title);
      setDraftId(draft.id);
      const lastTurn = draft.turns[draft.turns.length - 1];
      if (lastTurn) setPendingMessage(lastTurn.userMessage);
      hydratedDraftIdRef.current = draft.id;
    }
  }, [initialDraftId]);

  const aReady = hydrated && !!keys[configA.provider];
  const bReady = hydrated && !!keys[configB.provider];
  const canRun = aReady && bReady && pendingMessage.trim() && !running;

  function updateTurnOutput(
    turnId: string,
    which: "A" | "B",
    updater: (prev: DiffTurnOutput) => DiffTurnOutput,
  ) {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id !== turnId) return t;
        const key = which === "A" ? "outputA" : "outputB";
        return { ...t, [key]: updater(t[key]) };
      }),
    );
  }

  async function streamOne(
    turnId: string,
    which: "A" | "B",
    config: ConfigState,
    userMessage: string,
  ) {
    const apiKey = keys[config.provider];
    if (!apiKey) {
      updateTurnOutput(turnId, which, () => ({
        text: "",
        status: "error",
        error: `No key set for ${config.provider}.`,
      }));
      return;
    }

    try {
      const stream = runChat({
        provider: config.provider,
        model: config.model,
        system: config.system,
        messages: [{ role: "user", content: userMessage }],
        temperature: config.temperature,
        apiKey,
      });

      for await (const event of stream) {
        if (event.type === "text") {
          updateTurnOutput(turnId, which, (prev) => ({
            ...prev,
            text: prev.text + event.delta,
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            config.provider,
            config.model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateTurnOutput(turnId, which, (prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
            endMs: Date.now(),
          }));
          recordUsage({
            provider: config.provider,
            model: config.model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          updateTurnOutput(turnId, which, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateTurnOutput(turnId, which, (prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    }
  }

  async function runBoth() {
    const userMessage = pendingMessage.trim();
    if (!userMessage) return;
    const turnId = newTurnId();
    const startMs = Date.now();
    const newTurn: DiffTurn = {
      id: turnId,
      userMessage,
      outputA: { text: "", status: "running", startMs },
      outputB: { text: "", status: "running", startMs },
    };
    setTurns((prev) => [...prev, newTurn]);
    setRunning(true);
    await Promise.all([
      streamOne(turnId, "A", configA, userMessage),
      streamOne(turnId, "B", configB, userMessage),
    ]);
    setRunning(false);
  }

  function clearSession() {
    setTurns([]);
  }

  function deleteTurn(turnId: string) {
    setTurns((prev) => prev.filter((t) => t.id !== turnId));
  }

  function updateTurnNote(turnId: string, note: string) {
    setTurns((prev) =>
      prev.map((t) =>
        t.id === turnId ? { ...t, note: note || undefined } : t,
      ),
    );
  }

  function handleSaveDraft() {
    setSaveStatus("saving");
    const saved = saveDraft({
      id: draftId ?? undefined,
      kind: "diff",
      title:
        title.trim() ||
        suggestTitle(
          turns[0]?.userMessage ?? pendingMessage,
          "Untitled diff",
        ),
      configA,
      configB,
      turns,
    });
    setDraftId(saved.id);
    setTitle(saved.title);
    setSaveStatus("saved");
    if (!searchParams.get("draft")) {
      router.replace(`/play/diff?draft=${saved.id}`, { scroll: false });
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {hydrated && (!aReady || !bReady) && (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[14px] text-ink">
            You&apos;re missing a key for{" "}
            {!aReady && !bReady
              ? "both providers"
              : !aReady
              ? configA.provider
              : configB.provider}
            . Add one to run a diff.
          </p>
          <Link
            href="/settings/keys"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Set up keys →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConfigPanel
          label="Config A"
          config={configA}
          onChange={setConfigA}
          connected={aReady}
        />
        <ConfigPanel
          label="Config B"
          config={configB}
          onChange={setConfigB}
          connected={bReady}
        />
      </div>

      {turns.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Session log — {turns.length}{" "}
              {turns.length === 1 ? "turn" : "turns"}
            </h2>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={highlightDiff}
                  onChange={(e) => setHighlightDiff(e.target.checked)}
                  className="accent-[var(--highlight)]"
                />
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                  Highlight diffs
                </span>
              </label>
              <button
                type="button"
                onClick={clearSession}
                disabled={running}
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-danger disabled:opacity-40"
              >
                Clear session
              </button>
            </div>
          </div>
          {turns.map((t, i) => (
            <TurnRow
              key={t.id}
              num={i + 1}
              turn={t}
              configA={configA}
              configB={configB}
              highlightDiff={highlightDiff}
              onDelete={running ? undefined : () => deleteTurn(t.id)}
              onNoteChange={(note) => updateTurnNote(t.id, note)}
            />
          ))}
        </div>
      )}

      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          {turns.length > 0 ? "Next turn" : "User message"}
        </label>
        <textarea
          value={pendingMessage}
          onChange={(e) => setPendingMessage(e.target.value)}
          rows={3}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
          placeholder="What do you want to send to both models?"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runBoth}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running
              ? "Streaming…"
              : turns.length === 0
              ? "Run both"
              : "Run next turn"}
            <span className="text-highlight">→</span>
          </button>
          {turns.length > 0 && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Same configs, new message — outputs append below.
            </span>
          )}
        </div>
      </div>

      <DraftSaveBar
        title={title}
        onTitleChange={(next) => {
          setTitle(next);
          if (saveStatus === "saved") setSaveStatus("idle");
        }}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}
