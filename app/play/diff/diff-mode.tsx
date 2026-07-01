"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { useDefaultProvider } from "@/lib/hooks/use-default-provider";
import { useUnsavedWork } from "@/lib/hooks/use-unsaved-work";
import { runChat, type ChatMessage } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { providerNeedsKey, type ProviderId } from "@/lib/providers";
import {
  suggestTitle,
  type DiffDraft,
  type DiffMode as DiffModeKind,
  type DiffTurn,
  type DiffTurnOutput,
} from "@/lib/drafts";
import { DIFF_EXAMPLES, type DiffExample } from "@/lib/diff-examples";
import { REFLECTION } from "@/lib/reflection-questions";
import { InfoTip } from "@/components/info-tip";
import { UserMessageTip } from "@/components/play/config-help";
import { ConfigPanel, type ConfigState } from "@/components/play/config-panel";
import { TurnRow } from "@/components/play/turn-row";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";

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

/**
 * Reconstruct one side's conversation history from prior completed turns.
 * Each side builds its OWN history from its OWN outputs, so the two configs
 * accumulate independent context — the whole point of conversation mode.
 */
function buildHistory(turns: DiffTurn[], which: "A" | "B"): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  for (const t of turns) {
    const out = which === "A" ? t.outputA : t.outputB;
    if (out.status === "done" && out.text) {
      msgs.push({ role: "user", content: t.userMessage });
      msgs.push({ role: "assistant", content: out.text });
    }
  }
  return msgs;
}

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
  const [activeExample, setActiveExample] = useState<DiffExample | null>(null);
  const [turns, setTurns] = useState<DiffTurn[]>([]);
  const [mode, setMode] = useState<DiffModeKind>("independent");
  const [running, setRunning] = useState(false);
  const [highlightDiff, setHighlightDiff] = useState(false);
  const [pins, setPins] = useState<string[]>([]);
  const [selectionText, setSelectionText] = useState("");
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const hydrateFromDraft = useCallback((draft: DiffDraft) => {
    setConfigA(draft.configA);
    setReflectionNote(draft.reflection ?? "");
    setConfigB(draft.configB);
    setTurns(draft.turns);
    setMode(draft.mode ?? "independent");
    setPins(draft.pins ?? []);
    const lastTurn = draft.turns[draft.turns.length - 1];
    if (lastTurn) setPendingMessage(lastTurn.userMessage);
  }, []);

  const conversation = mode === "conversation";

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

  // Default both configs to the user's BYOK provider when one is set up,
  // keeping each side's distinct system prompt + temperature.
  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: useCallback((p: ProviderId, m: string) => {
      setConfigA((c) => ({ ...c, provider: p, model: m }));
      setConfigB((c) => ({ ...c, provider: p, model: m }));
    }, []),
  });

  const completedTurns = turns.filter(
    (t) => t.outputA.status === "done" && t.outputB.status === "done",
  ).length;
  const showReflection =
    completedTurns >= 2 && !running && !reflectionDismissed;
  const reflection = conversation
    ? REFLECTION.diffConversation
    : REFLECTION.diffIndependent;

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
    history: ChatMessage[],
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
        messages: [...history, { role: "user", content: apiMessage }],
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
    // Pins simulate carrying context forward; in conversation mode the real
    // history does that, so pins only apply to independent runs.
    const pinsSnapshot = conversation ? [] : [...pins];
    const apiMessage = withPinReminder(userMessage, pinsSnapshot);
    // Snapshot prior turns BEFORE appending the new one, for per-side history.
    const priorTurns = turns;
    const historyA = conversation ? buildHistory(priorTurns, "A") : [];
    const historyB = conversation ? buildHistory(priorTurns, "B") : [];
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
    setDirty(true);
    setRunning(true);
    await Promise.all([
      streamOne(turnId, "A", configA, historyA, apiMessage),
      streamOne(turnId, "B", configB, historyB, apiMessage),
    ]);
    setRunning(false);
  }

  function clearSession() {
    setTurns([]);
    setDirty(false);
  }

  function loadExample(ex: DiffExample) {
    if (
      turns.length > 0 &&
      !window.confirm(
        "Load this example? It replaces both system prompts and clears the current session.",
      )
    ) {
      return;
    }
    // Keep each side's provider/model; only swap the prompt + temperature.
    setConfigA((c) => ({ ...c, system: ex.systemA, temperature: ex.tempA }));
    setConfigB((c) => ({ ...c, system: ex.systemB, temperature: ex.tempB }));
    setPendingMessage(ex.message);
    setActiveExample(ex);
    setTurns([]);
    setPins([]);
    setDirty(false);
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
      mode,
      pins: pins.length ? pins : undefined,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
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
      <WebLLMUnsupportedBanner
        show={
          configA.provider === "webllm" || configB.provider === "webllm"
        }
      />

      <div className="bg-surface border border-line rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5">
          <ModeButton
            active={!conversation}
            disabled={running}
            onClick={() => {
              setMode("independent");
              setReflectionDismissed(false);
            }}
          >
            Independent
          </ModeButton>
          <ModeButton
            active={conversation}
            disabled={running}
            onClick={() => {
              setMode("conversation");
              setReflectionDismissed(false);
            }}
          >
            Conversation
          </ModeButton>
        </div>
        <p className="font-mono text-[11px] leading-[1.5] text-ink-quiet max-w-md">
          {conversation
            ? "Each side keeps its own history — watch the two configs drift apart over a real conversation."
            : "Each run is a fresh single-shot prompt through both configs. No memory between runs."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mr-1">
          Try an example
        </span>
        {DIFF_EXAMPLES.map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => loadExample(ex)}
            disabled={running}
            title={ex.lever}
            className="font-mono text-[11px] tracking-[0.02em] text-ink-muted border border-line rounded-full px-3 py-1 hover:border-ink-muted hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {ex.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConfigPanel
          label="Config A"
          config={configA}
          onChange={(next) => {
            setConfigA(next);
            setActiveExample(null);
          }}
          connected={aReady}
        />
        <ConfigPanel
          label="Config B"
          config={configB}
          onChange={(next) => {
            setConfigB(next);
            setActiveExample(null);
          }}
          connected={bReady}
        />
      </div>

      {activeExample && turns.length === 0 && (
        <SampleRunCard
          example={activeExample}
          canRun={!!canRun}
          running={running}
          onRunLive={runBoth}
        />
      )}

      {turns.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              {conversation
                ? `Conversation — ${turns.length} ${
                    turns.length === 1 ? "turn" : "turns"
                  }`
                : `Comparison log — ${turns.length} ${
                    turns.length === 1 ? "run" : "runs"
                  }`}
            </h2>
            <div className="flex items-center gap-4">
              {!conversation && (
                <button
                  type="button"
                  onClick={pinSelection}
                  disabled={!selectionText}
                  title={
                    selectionText
                      ? `Pin "${selectionText.slice(0, 60)}${
                          selectionText.length > 60 ? "…" : ""
                        }" — carried into every future run as a reminder.`
                      : "Highlight a phrase in an output to enable."
                  }
                  className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2 disabled:opacity-40 disabled:no-underline disabled:text-ink-quiet disabled:cursor-not-allowed"
                >
                  + Pin selection
                </button>
              )}
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
          {!conversation && pins.length === 0 && !running && (
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Tip — highlight a phrase in any output, then{" "}
              <span className="text-ink-muted">+ Pin selection</span> to carry
              it through future runs.
            </p>
          )}
          <div
            className={
              conversation
                ? "flex flex-col gap-3 border-l-2 border-highlight/40 pl-4"
                : "flex flex-col gap-3"
            }
          >
            {turns.map((t, i) => (
              <TurnRow
                key={t.id}
                num={i + 1}
                turn={t}
                configA={configA}
                configB={configB}
                highlightDiff={highlightDiff}
                label={conversation ? "Turn" : "Run"}
                onDelete={running ? undefined : () => deleteTurn(t.id)}
                onNoteChange={(note) => updateTurnNote(t.id, note)}
              />
            ))}
          </div>
        </div>
      )}

      {showReflection && (
        <ReflectionCard
          reflection={reflection}
          answer={reflectionNote}
          onAnswerChange={(v) => {
            setReflectionNote(v);
            setDirty(true);
          }}
          onDismiss={() => setReflectionDismissed(true)}
        />
      )}

      <div className="bg-surface border border-line rounded-[16px] p-5">
        {!conversation && pins.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              Pinned — added to each new run as a reminder to the model
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
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mb-2 inline-flex items-center gap-1.5">
          {turns.length === 0
            ? "User message"
            : conversation
            ? "Next turn"
            : "New message"}
          <InfoTip>{UserMessageTip}</InfoTip>
        </label>
        <textarea
          value={pendingMessage}
          onChange={(e) => setPendingMessage(e.target.value)}
          rows={3}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
          placeholder={
            conversation
              ? "Continue the conversation with both configs…"
              : "What do you want to send to both models?"
          }
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
              ? conversation
                ? "Start the conversation"
                : "Run both"
              : conversation
              ? "Send next turn"
              : "Run again"}
            <span className="text-highlight">→</span>
          </button>
          {turns.length > 0 && (
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              {conversation
                ? "Each side replies with its own history in context."
                : "Same configs, fresh prompt — outputs append below."}
            </span>
          )}
        </div>
      </div>

      <DraftSaveBar
        artifact="Diff Log"
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}

/**
 * Recorded sample outputs for a just-loaded example preset. Lets a first-time
 * visitor feel the contrast in seconds — before any model has downloaded and
 * without a key — with "Run it live" as the follow-up. Hidden as soon as a
 * real turn exists or a config is edited by hand.
 */
function SampleRunCard({
  example,
  canRun,
  running,
  onRunLive,
}: {
  example: DiffExample;
  canRun: boolean;
  running: boolean;
  onRunLive: () => void;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Sample run — recorded, not live
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
          {example.name}
        </span>
      </div>

      <p className="font-sans text-[14px] leading-[1.55] text-ink-muted">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mr-2">
          Message
        </span>
        {example.message}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(["A", "B"] as const).map((which) => (
          <div
            key={which}
            className="bg-canvas border border-line rounded-[12px] p-4 flex flex-col gap-2"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Config {which} — sample
            </span>
            <p className="font-mono text-[13px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
              {which === "A" ? example.sample.outputA : example.sample.outputB}
            </p>
          </div>
        ))}
      </div>

      <p className="font-sans text-[13px] leading-[1.55] text-ink-muted border-l-2 border-highlight pl-3">
        <span className="font-medium text-ink">What to notice — </span>
        {example.lever}
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onRunLive}
          disabled={!canRun}
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running ? "Streaming…" : "Run it live"}
          <span className="text-highlight">→</span>
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Same message, your selected models — outputs will differ from the
          sample
        </span>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-[8px] px-3 py-1.5 transition-colors disabled:cursor-not-allowed ${
        active
          ? "bg-ink text-canvas"
          : "text-ink-muted hover:text-ink disabled:opacity-50"
      }`}
    >
      {children}
    </button>
  );
}
