"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftHydration } from "@/lib/hooks/use-draft-hydration";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_CHOREOGRAPHER_PROMPT,
  EMPTY_ASSISTANT,
  SEED_TURNS,
  buildHistoryUpTo,
  completedTurnCount,
  makeEmptyTurn,
  type AssistantResult,
  type ChoreographedTurn,
} from "@/lib/choreographer";
import { saveDraft, suggestTitle, type ChoreographerDraft } from "@/lib/drafts";
import { ChoreographerTurnRow } from "@/components/play/choreographer-turn-row";
import {
  DraftSaveBar,
  type DraftSaveStatus,
} from "@/components/play/draft-save-bar";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";

const MAX_TURNS = 10;

export function Choreographer() {
  const { keys, hydrated } = useKeys();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(PROVIDERS.anthropic.defaultModel);
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_CHOREOGRAPHER_PROMPT);
  const [turns, setTurns] = useState<ChoreographedTurn[]>(SEED_TURNS);
  const [running, setRunning] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateFromDraft = useCallback((draft: ChoreographerDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setSystemPrompt(draft.systemPrompt);
    setTurns(draft.turns);
    setTitle(draft.title);
    setDraftId(draft.id);
  }, []);
  useDraftHydration(initialDraftId, "choreographer", hydrateFromDraft);

  const ready = hydrated && !!keys[provider];
  const completed = completedTurnCount(turns);

  function updateTurn(
    id: string,
    patch:
      | Partial<ChoreographedTurn>
      | ((prev: ChoreographedTurn) => ChoreographedTurn),
  ) {
    setTurns((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        return typeof patch === "function" ? patch(t) : { ...t, ...patch };
      }),
    );
  }

  function updateAssistant(
    id: string,
    updater: (prev: AssistantResult) => AssistantResult,
  ) {
    setTurns((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, assistant: updater(t.assistant) } : t,
      ),
    );
  }

  function addTurn() {
    if (turns.length >= MAX_TURNS) return;
    setTurns((prev) => [...prev, makeEmptyTurn()]);
  }

  function deleteTurn(id: string) {
    setTurns((prev) => prev.filter((t) => t.id !== id));
  }

  function resetResponses() {
    setTurns((prev) =>
      prev.map((t) => ({
        ...t,
        assistant: { ...EMPTY_ASSISTANT, note: t.assistant.note },
      })),
    );
  }

  async function runFlow() {
    const apiKey = keys[provider];
    if (!apiKey) return;
    setRunning(true);

    // Reset all turns to running/idle first so we have a clean slate.
    const baseTurns = turns.map((t) => ({
      ...t,
      assistant: { ...EMPTY_ASSISTANT, note: t.assistant.note },
    }));
    setTurns(baseTurns);

    // We need to capture the live state as we iterate; pull it from a local
    // working copy and re-stream into React state per delta.
    const working: ChoreographedTurn[] = baseTurns.map((t) => ({
      ...t,
      assistant: { ...t.assistant },
    }));

    for (let i = 0; i < working.length; i++) {
      const turn = working[i];
      if (!turn.userMessage.trim()) {
        // Skip empty turns.
        continue;
      }
      const history = buildHistoryUpTo(working, i);
      updateAssistant(turn.id, () => ({
        ...EMPTY_ASSISTANT,
        status: "running",
        startMs: Date.now(),
        note: turn.assistant.note,
      }));

      try {
        const stream = runChat({
          provider,
          model,
          system: systemPrompt,
          messages: [
            ...history,
            { role: "user", content: turn.userMessage },
          ],
          temperature,
          apiKey,
        });
        for await (const event of stream) {
          if (event.type === "text") {
            updateAssistant(turn.id, (prev) => ({
              ...prev,
              text: prev.text + event.delta,
            }));
            working[i].assistant.text += event.delta;
          } else if (event.type === "done") {
            const cost = calcCost(
              provider,
              model,
              event.usage.inputTokens,
              event.usage.outputTokens,
            );
            updateAssistant(turn.id, (prev) => ({
              ...prev,
              status: "done",
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
              costUsd: cost,
              endMs: Date.now(),
            }));
            working[i].assistant.status = "done";
            working[i].assistant.inputTokens = event.usage.inputTokens;
            working[i].assistant.outputTokens = event.usage.outputTokens;
            recordUsage({
              provider,
              model,
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
            });
          } else if (event.type === "error") {
            updateAssistant(turn.id, (prev) => ({
              ...prev,
              status: "error",
              error: event.message,
              endMs: Date.now(),
            }));
            working[i].assistant.status = "error";
            working[i].assistant.error = event.message;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        updateAssistant(turn.id, (prev) => ({
          ...prev,
          status: "error",
          error: message,
          endMs: Date.now(),
        }));
        working[i].assistant.status = "error";
        working[i].assistant.error = message;
      }

      // If a turn errored or there's no assistant text, don't pass it as
      // history — but continue running subsequent turns from where the
      // conversation last had a real response.
      if (working[i].assistant.status === "error") {
        // Stop the flow on error to avoid noisy downstream turns.
        break;
      }
    }
    setRunning(false);
  }

  function handleSaveDraft() {
    setSaveStatus("saving");
    const saved = saveDraft({
      id: draftId ?? undefined,
      kind: "choreographer",
      title:
        title.trim() ||
        suggestTitle(
          turns[0]?.userMessage ?? systemPrompt,
          "Untitled choreography",
        ),
      provider,
      model,
      temperature,
      systemPrompt,
      turns,
    });
    setDraftId(saved.id);
    setTitle(saved.title);
    setSaveStatus("saved");
    if (!searchParams.get("draft")) {
      router.replace(`/play/choreographer?draft=${saved.id}`, {
        scroll: false,
      });
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {hydrated && !ready && (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[14px] text-ink">
            You&apos;re missing a key for{" "}
            <span className="font-mono text-[13px]">
              {PROVIDERS[provider].name}
            </span>
            . Add one to run the flow.
          </p>
          <Link
            href="/settings/keys"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Set up keys →
          </Link>
        </div>
      )}

      {/* Provider / model / temperature */}
      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      {/* System prompt */}
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          System prompt
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <p className="mt-2 font-mono text-[10px] text-ink-quiet">
          This sets the persona under test. Specifying coherence behavior
          here (&ldquo;reference what you just said,&rdquo; &ldquo;don&apos;t
          backpedal&rdquo;) is part of the design.
        </p>
      </div>

      {/* Run row */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runFlow}
            disabled={!ready || running}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Running…" : "Run flow"}
            <span className="text-highlight">→</span>
          </button>
          <button
            type="button"
            onClick={resetResponses}
            disabled={running}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Reset responses
          </button>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {completed} of {turns.length}{" "}
          {turns.length === 1 ? "turn" : "turns"} complete
        </div>
      </div>

      {/* Turn list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            Scripted flow — {turns.length} turns
          </p>
          <button
            type="button"
            onClick={addTurn}
            disabled={turns.length >= MAX_TURNS || running}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2 disabled:opacity-40 disabled:no-underline disabled:text-ink-quiet"
          >
            + Add turn
          </button>
        </div>
        {turns.map((t, i) => (
          <ChoreographerTurnRow
            key={t.id}
            num={i + 1}
            turn={t}
            onUserMessageChange={(msg) =>
              updateTurn(t.id, { userMessage: msg })
            }
            onNoteChange={(note) =>
              updateAssistant(t.id, (prev) => ({
                ...prev,
                note: note || undefined,
              }))
            }
            onDelete={() => deleteTurn(t.id)}
            canDelete={turns.length > 1 && !running}
          />
        ))}
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

