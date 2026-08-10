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
import { suggestTitle, type RaceDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import {
  EMPTY_RACE_RESULT,
  SEED_MESSAGE,
  SEED_SYSTEM,
  SEED_WEBLLM_A,
  SEED_WEBLLM_B,
  buildVerdict,
  fastestModelFor,
  lanesContendForGpu,
  totalMs,
  type LaneId,
  type RaceResult,
} from "@/lib/race";
import { ConfigPanel, type ConfigState } from "@/components/play/config-panel";
import { RaceLane } from "@/components/play/race-lane";
import { RaceTimeline } from "@/components/play/race-timeline";
import { RaceVerdictPanel } from "@/components/play/race-verdict";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";

const INITIAL_A: ConfigState = {
  provider: "webllm",
  model: SEED_WEBLLM_A,
  system: SEED_SYSTEM,
  temperature: 0.7,
};

const INITIAL_B: ConfigState = {
  provider: "webllm",
  model: SEED_WEBLLM_B,
  system: SEED_SYSTEM,
  temperature: 0.7,
};

export function RaceMode() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [configA, setConfigA] = useState<ConfigState>(INITIAL_A);
  const [configB, setConfigB] = useState<ConfigState>(INITIAL_B);
  const [userMessage, setUserMessage] = useState(SEED_MESSAGE);
  const [laneA, setLaneA] = useState<RaceResult>(EMPTY_RACE_RESULT);
  const [laneB, setLaneB] = useState<RaceResult>(EMPTY_RACE_RESULT);
  const [running, setRunning] = useState(false);
  const [pick, setPick] = useState<LaneId | null>(null);
  const [pickNote, setPickNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const applyDraft = useCallback((draft: RaceDraft) => {
    setConfigA(draft.configA);
    setConfigB(draft.configB);
    setUserMessage(draft.userMessage);
    setLaneA(draft.laneA);
    setLaneB(draft.laneB);
    setPick(draft.pick ?? null);
    setPickNote(draft.pickNote ?? "");
    setReflectionNote(draft.reflection ?? "");
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/race",
    kind: "race",
    apply: applyDraft,
  });

  // With a key on hand, the sharpest default is frontier-vs-fast on the same
  // provider: same vendor, same prompt, very different bill.
  const handleResolveProvider = useCallback(
    (provider: ProviderId, model: string) => {
      setConfigA((prev) => ({ ...prev, provider, model }));
      setConfigB((prev) => ({
        ...prev,
        provider,
        model: fastestModelFor(provider),
      }));
    },
    [],
  );

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: handleResolveProvider,
  });

  const keyReadyA = !providerNeedsKey(configA.provider) || !!keys[configA.provider];
  const keyReadyB = !providerNeedsKey(configB.provider) || !!keys[configB.provider];
  const missingProvider = !keyReadyA
    ? configA.provider
    : !keyReadyB
    ? configB.provider
    : null;

  const gpuContention = lanesContendForGpu(configA.provider, configB.provider);
  const usesWebLLM =
    configA.provider === "webllm" || configB.provider === "webllm";

  const verdict = useMemo(() => buildVerdict(laneA, laneB), [laneA, laneB]);

  const firstLane = useMemo<LaneId | null>(() => {
    if (!verdict.complete) return null;
    const a = totalMs(laneA);
    const b = totalMs(laneB);
    if (a == null || b == null || a === b) return null;
    return a < b ? "a" : "b";
  }, [verdict.complete, laneA, laneB]);

  const showReflection =
    verdict.complete && !running && !!pick && !reflectionDismissed;

  async function runLane(
    config: ConfigState,
    setLane: React.Dispatch<React.SetStateAction<RaceResult>>,
  ) {
    const apiKey = keys[config.provider];
    // Each lane clocks its own request rather than the Run click, so the
    // numbers stay true even when the two can't genuinely run at once.
    const startMs = Date.now();
    setLane({ ...EMPTY_RACE_RESULT, status: "running", startMs });
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
          setLane((prev) => ({
            ...prev,
            text: prev.text + event.delta,
            firstTokenMs: prev.firstTokenMs ?? Date.now(),
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            config.provider,
            config.model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          setLane((prev) => ({
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
          setLane((prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLane((prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    }
  }

  async function runRace() {
    if (!keyReadyA || !keyReadyB || !userMessage.trim()) return;
    setRunning(true);
    setDirty(true);
    setPick(null);
    setPickNote("");
    setReflectionDismissed(false);
    await Promise.all([runLane(configA, setLaneA), runLane(configB, setLaneB)]);
    setRunning(false);
  }

  function handleSave() {
    save({
      title: title.trim() || suggestTitle(userMessage, "Untitled race"),
      configA,
      configB,
      userMessage,
      laneA,
      laneB,
      pick,
      pickNote: pickNote.trim() || undefined,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  const labelA = "Lane A";
  const labelB = "Lane B";

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !!missingProvider}
        providerName={missingProvider ? PROVIDERS[missingProvider].name : ""}
        action="run the race"
      />
      <WebLLMUnsupportedBanner show={usesWebLLM} />

      {gpuContention && (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4">
          <p className="font-sans text-[14px] leading-[1.5] text-ink">
            Both lanes use the free in-browser engine, which holds a single GPU
            context and runs one model at a time. Each lane still times its own
            request honestly, so the throughput and first-token numbers are
            real — but they aren&apos;t running side by side, so treat the
            timeline as two separate measurements rather than a live race.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ConfigPanel
          label="Lane A"
          config={configA}
          onChange={setConfigA}
          connected={keyReadyA}
        />
        <ConfigPanel
          label="Lane B"
          config={configB}
          onChange={setConfigB}
          connected={keyReadyB}
        />
      </div>

      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            User message
          </span>
          <textarea
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            rows={2}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          {usesWebLLM && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              First in-browser run includes the model download
            </span>
          )}
          <button
            type="button"
            onClick={runRace}
            disabled={
              running || !keyReadyA || !keyReadyB || !userMessage.trim()
            }
            className="ml-auto inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Racing…" : "Run the race"}
          </button>
        </div>
      </div>

      {verdict.complete && (
        <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6">
          <RaceTimeline a={laneA} b={laneB} labelA={labelA} labelB={labelB} />
        </div>
      )}

      <RaceVerdictPanel
        verdict={verdict}
        labelA={labelA}
        labelB={labelB}
        pick={pick}
        onPick={setPick}
        pickNote={pickNote}
        onPickNoteChange={setPickNote}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RaceLane
          label={labelA}
          config={configA}
          result={laneA}
          winner={firstLane === "a"}
        />
        <RaceLane
          label={labelB}
          config={configB}
          result={laneB}
          winner={firstLane === "b"}
        />
      </div>

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.race}
          onDismiss={() => setReflectionDismissed(true)}
          answer={reflectionNote}
          onAnswerChange={setReflectionNote}
        />
      )}

      <DraftSaveBar
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSave}
        disabled={laneA.status === "idle" && laneB.status === "idle"}
        artifact="Speed Trial"
      />
    </div>
  );
}
