"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_PERSONA,
  composePersonaPrompt,
  isPersonaEmpty,
  type PersonaValues,
} from "@/lib/persona";
import { suggestTitle, type PersonaDraft } from "@/lib/drafts";
import { PersonaForm } from "@/components/play/persona-form";
import { OutputPanel, type OutputState } from "@/components/play/output-panel";
import type { ConfigState } from "@/components/play/config-panel";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";

const EMPTY_OUTPUT: OutputState = {
  text: "",
  status: "idle",
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

const DEFAULT_MESSAGE =
  "I'm about to interview a designer about their workflow. What should I ask first?";

export function PersonaWorkshop() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(PROVIDERS.anthropic.defaultModel);
  const [temperature, setTemperature] = useState(0.7);
  const [persona, setPersona] = useState<PersonaValues>(DEFAULT_PERSONA);
  const [userMessage, setUserMessage] = useState(DEFAULT_MESSAGE);
  const [output, setOutput] = useState<OutputState>(EMPTY_OUTPUT);
  const [running, setRunning] = useState(false);

  const hydrateFromDraft = useCallback((draft: PersonaDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setPersona(draft.persona);
    setUserMessage(draft.lastUserMessage);
    if (draft.lastOutput) {
      setOutput({ ...EMPTY_OUTPUT, text: draft.lastOutput, status: "done" });
    }
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/persona",
    kind: "persona",
    apply: hydrateFromDraft,
  });

  const composedSystem = useMemo(
    () => composePersonaPrompt(persona),
    [persona],
  );
  const personaEmpty = isPersonaEmpty(persona);

  const ready = hydrated && !!keys[provider];
  const canRun =
    ready && userMessage.trim() && !running && !personaEmpty;

  async function run() {
    const apiKey = keys[provider];
    if (!apiKey) return;

    setRunning(true);
    setOutput({ ...EMPTY_OUTPUT, status: "running", startMs: Date.now() });

    try {
      const stream = runChat({
        provider,
        model,
        system: composedSystem,
        messages: [{ role: "user", content: userMessage }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          setOutput((prev) => ({ ...prev, text: prev.text + event.delta }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          setOutput((prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
            endMs: Date.now(),
          }));
          recordUsage({
            provider,
            model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          setOutput((prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOutput((prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    } finally {
      setRunning(false);
    }
  }

  function reset() {
    setOutput(EMPTY_OUTPUT);
  }

  function handleSaveDraft() {
    save({
      title:
        title.trim() ||
        suggestTitle(persona.name || persona.role, "Untitled persona"),
      provider,
      model,
      temperature,
      persona,
      lastUserMessage: userMessage,
      lastOutput: output.text || undefined,
    });
  }

  const config: ConfigState = {
    provider,
    model,
    system: composedSystem,
    temperature,
  };

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !ready}
        providerName={PROVIDERS[provider].name}
        action="test the persona"
      />

      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PersonaForm values={persona} onChange={setPersona} />
        <ComposedPromptCard system={composedSystem} empty={personaEmpty} />
      </div>

      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          Ask the persona
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          rows={2}
          placeholder="Test the persona with a real question."
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Streaming…" : "Ask"}
            <span className="text-highlight">→</span>
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={running}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Clear output
          </button>
          {personaEmpty && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Add a name or role first
            </span>
          )}
        </div>
      </div>

      <OutputPanel label="Output" config={config} output={output} />

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

function ComposedPromptCard({
  system,
  empty,
}: {
  system: string;
  empty: boolean;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Composed system prompt
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {empty ? "Empty" : "Live"}
        </span>
      </div>

      <div className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
        {empty ? (
          <span className="text-ink-quiet italic">
            Fill in name + role to compose a prompt.
          </span>
        ) : (
          system
        )}
      </div>
    </div>
  );
}

