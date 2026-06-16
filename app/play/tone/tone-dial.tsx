"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { useDefaultProvider } from "@/lib/hooks/use-default-provider";
import { useUnsavedWork } from "@/lib/hooks/use-unsaved-work";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDERS, providerNeedsKey, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_TONE,
  TONE_INITIAL,
  composeSystemPrompt,
  composeToneLines,
  type ToneLine,
  type ToneValues,
} from "@/lib/tone";
import { suggestTitle, type ToneDraft } from "@/lib/drafts";
import { slugify } from "@/lib/download";
import { REFLECTION } from "@/lib/reflection-questions";
import { ToneDialControls } from "@/components/play/tone-dial-controls";
import { OutputPanel, type OutputState } from "@/components/play/output-panel";
import type { ConfigState } from "@/components/play/config-panel";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ReflectionCard } from "@/components/play/reflection-card";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";

const EMPTY_OUTPUT: OutputState = {
  text: "",
  status: "idle",
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

const DEFAULT_BRIEF =
  "You are writing onboarding copy for a meditation app aimed at first-time users.";

const DEFAULT_MESSAGE =
  "Write a one-sentence welcome for someone who just opened the app for the first time.";

export function ToneDial() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState<string>(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.7);
  const [brief, setBrief] = useState(DEFAULT_BRIEF);
  const [userMessage, setUserMessage] = useState(DEFAULT_MESSAGE);
  const [tone, setTone] = useState<ToneValues>(DEFAULT_TONE);
  const [output, setOutput] = useState<OutputState>(EMPTY_OUTPUT);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [runCount, setRunCount] = useState(0);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);

  useUnsavedWork(dirty);

  const hydrateFromDraft = useCallback((draft: ToneDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setBrief(draft.brief);
    setTone(draft.tone);
    setUserMessage(draft.lastUserMessage);
    if (draft.lastOutput) {
      setOutput({ ...EMPTY_OUTPUT, text: draft.lastOutput, status: "done" });
    }
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/tone",
    kind: "tone",
    apply: hydrateFromDraft,
  });

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: useCallback((p: ProviderId, m: string) => {
      setProvider(p);
      setModel(m);
    }, []),
  });

  function handleSaveDraft() {
    save({
      title: title.trim() || suggestTitle(brief, "Untitled tone"),
      provider,
      model,
      temperature,
      brief,
      tone,
      lastUserMessage: userMessage,
      lastOutput: output.text || undefined,
    });
    setDirty(false);
  }

  const composedSystem = useMemo(
    () => composeSystemPrompt(brief, tone),
    [brief, tone],
  );
  const toneLines = useMemo(() => composeToneLines(tone), [tone]);
  const dialsTouched = toneLines.length > 0;

  const ready = hydrated && (!providerNeedsKey(provider) || !!keys[provider]);
  const canRun = ready && userMessage.trim() && !running;

  async function run() {
    const apiKey = keys[provider];
    if (providerNeedsKey(provider) && !apiKey) return;

    setRunning(true);
    setDirty(true);
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
          setRunCount((n) => n + 1);
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
    setDirty(false);
  }

  // OutputPanel expects a ConfigState; build a synthetic one.
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
        action="run the dials"
      />
      <WebLLMUnsupportedBanner show={provider === "webllm"} />

      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: brief + dials */}
        <div className="flex flex-col gap-4">
          <div className="bg-surface border border-line rounded-[16px] p-5">
            <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
              Brief — the task and context
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              placeholder="Describe what this assistant does and for whom."
              className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
            />
            <p className="mt-2 font-mono text-[11px] text-ink-quiet">
              The dials below add tone instructions to this brief.
            </p>
          </div>

          <ToneDialControls values={tone} onChange={setTone} />
        </div>

        {/* Right: composed prompt preview + output */}
        <div className="flex flex-col gap-4">
          <ComposedPromptCard
            brief={brief}
            toneLines={toneLines}
            dialsTouched={dialsTouched}
          />
        </div>
      </div>

      {/* Run row */}
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          User message
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          rows={2}
          placeholder="What do you want to send through the dials?"
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Streaming…" : "Run with this tone"}
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
        </div>
      </div>

      <OutputPanel
        label="Output"
        config={config}
        output={output}
        filenameStem={`tone-${slugify(title || brief, "output")}`}
      />

      {runCount >= 2 && !running && !reflectionDismissed && (
        <ReflectionCard
          reflection={REFLECTION.tone}
          onDismiss={() => setReflectionDismissed(true)}
        />
      )}

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
  brief,
  toneLines,
  dialsTouched,
}: {
  brief: string;
  toneLines: ToneLine[];
  dialsTouched: boolean;
}) {
  const trimmedBrief = brief.trim();

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Composed system prompt
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {dialsTouched ? "Dials active" : "Dials at neutral"}
        </span>
      </div>

      <div className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
        {trimmedBrief ? (
          trimmedBrief
        ) : (
          <span className="text-ink-quiet italic">No brief yet.</span>
        )}
      </div>

      {dialsTouched && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Tone
          </p>
          {toneLines.map((line) => (
            <div key={line.dim} className="flex items-start gap-2">
              <span
                className="inline-block font-mono text-[10px] font-medium leading-none w-5 h-5 rounded-full text-center pt-1 bg-ink text-canvas shrink-0"
                aria-hidden
              >
                {TONE_INITIAL[line.dim]}
              </span>
              <p className="font-mono text-[12px] leading-[1.55] text-ink">
                {line.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {!dialsTouched && (
        <p className="font-mono text-[11px] text-ink-quiet">
          Move a dial off Neutral to see tone instructions stack into the prompt.
        </p>
      )}
    </div>
  );
}

