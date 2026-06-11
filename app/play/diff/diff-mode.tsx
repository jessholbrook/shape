"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { providerNeedsKey } from "@/lib/providers";
import {
  suggestTitle,
  type DiffDraft,
  type DiffTurn,
  type DiffTurnOutput,
} from "@/lib/drafts";
import { ConfigPanel, type ConfigState } from "@/components/play/config-panel";
import { TurnRow } from "@/components/play/turn-row";
import { DraftSaveBar } from "@/components/play/draft-save-bar";

const MAX_PIN_LENGTH = 200;

function normalizePin(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_PIN_LENGTH);
}

function withPinReminder(message: string, pins: string[]): string {
  if (pins.length === 0) return message;
  const list = pins.map((p) => `"${p}"`).join("; ");
  return `(Keep these from earlier in mind: ${list}.)\n\n${message}`;
}

const INITIAL_A: ConfigState = {
  provider: "webllm",
  model: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  system: "You are a thoughtful UX writer. Be warm and concise.",
  temperature: 0.7,
};

const INITIAL_B: ConfigState = {
  provider: "webllm",
  model: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  system: "You are a thoughtful UX writer. Be playful — wordplay welcome.",
  temperature: 0.9,
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
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [configA, setConfigA] = useState<ConfigState>(INITIAL_A);
  const [configB, setConfigB] = useState<ConfigState>(INITIAL_B);
  const [pendingMessage, setPendingMessage] = useState(DEFAULT_MESSAGE);
  const [turns, setTurns] = useState<DiffTurn[]>([]);
  const [running, setRunning] = useState(false);
  const [highlightDiff, setHighlightDiff] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [selectionText, setSelectionText] = useState("");

  const hydrateFromDraft = useCallback((draft: DiffDraft) => {
    setConfigA(draft.configA);
    setConfigB(draft.configB);
    setTurns(draft.turns);
    setPins(draft.pins ?? []);
    const lastTurn = draft.turns[draft.turns.length - 1];
    if (lastTurn) setPendingMessage(lastTurn.userMessage);
  }, []);

  useEffect(() => {
    function handleSelectionChange() {
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      const text = sel?.toString() ?? "";
      setSelectionText(normalizePin(text));
    }
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  function pinSelection() {
    const candidate = normalizePin(selectionText);
    if (!candidate) return;
    if (pins.includes(candidate)) return;
    setPins((prev) => [...prev, candidate]);
    // Drop the selection so the button settles back to disabled.
    if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
    setSelectionText("");
  }

  function removePin(phrase: string) {
    setPins((prev) => prev.filter((p) => p !== phrase));
  }
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/diff",
    kind: "diff",
    apply: hydrateFromDraft,
  });

  const aReady =
    hydrated &&
    (!providerNeedsKey(configA.provider) || !!keys[configA.provider]);
  const bReady =
    hydrated &&
    (!providerNeedsKey(configB.provider) || !!keys[configB.provider]);
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
    apiMessage: string,
  ) {
    const apiKey = keys[config.provider];
    if (providerNeedsKey(config.provider) && !apiKey) {
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
        messages: [{ role: "user", content: apiMessage }],
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
    const pinsSnapshot = [...pins];
    const apiMessage = withPinReminder(userMessage, pinsSnapshot);
    const turnId = newTurnId();
    const startMs = Date.now();
    const newTurn: DiffTurn = {
      id: turnId,
      userMessage,
      outputA: { text: "", status: "running", startMs },
      outputB: { text: "", status: "running", startMs },
      pinsApplied: pinsSnapshot.length ? pinsSnapshot : undefined,
    };
    setTurns((prev) => [...prev, newTurn]);
    setRunning(true);
    await Promise.all([
      streamOne(turnId, "A", configA, apiMessage),
      streamOne(turnId, "B", configB, apiMessage),
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
    save({
      title:
        title.trim() ||
        suggestTitle(
          turns[0]?.userMessage ?? pendingMessage,
          "Untitled diff",
        ),
      configA,
      configB,
      turns,
      pins: pins.length ? pins : undefined,
    });
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
              <button
                type="button"
                onClick={pinSelection}
                disabled={!selectionText}
                title={
                  selectionText
                    ? `Pin "${selectionText.slice(0, 60)}${
                        selectionText.length > 60 ? "…" : ""
                      }" — injected as a reminder on future turns.`
                    : "Highlight a phrase in an output to enable."
                }
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2 disabled:opacity-40 disabled:no-underline disabled:text-ink-quiet disabled:cursor-not-allowed"
              >
                + Pin selection
              </button>
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
        {pins.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              Pinned — injected as a reminder before the next message
            </p>
            <div className="flex flex-wrap gap-1.5">
              {pins.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 bg-highlight-soft text-highlight-ink rounded-full pl-2.5 pr-1 py-0.5 font-mono text-[11px] max-w-[280px]"
                >
                  <span className="truncate" title={p}>
                    &ldquo;{p}&rdquo;
                  </span>
                  <button
                    type="button"
                    onClick={() => removePin(p)}
                    aria-label={`Remove pinned phrase ${p}`}
                    className="text-highlight-ink/70 hover:text-highlight-ink rounded-full w-4 h-4 inline-flex items-center justify-center leading-none"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}
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
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}
