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
import { suggestTitle, type PortabilityDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import {
  BYOK_CONCURRENCY,
  newId,
  runPool,
  type Assertion,
} from "@/lib/spread";
import {
  DEFAULT_RUNS_PER_MODEL,
  RUNS_PER_MODEL,
  SEED_ASSERTIONS,
  SEED_MESSAGE,
  SEED_SYSTEM,
  WEBLLM_RUNS_PER_MODEL,
  buildPortabilityReport,
  estimateMatrixCost,
  newRefId,
  type LaneResult,
  type LaneRun,
  type ModelRef,
} from "@/lib/portability";
import { AssertionRow } from "@/components/play/assertion-row";
import { ModelRoster } from "@/components/play/model-roster";
import { PortabilityMatrix } from "@/components/play/portability-matrix";
import { PortabilityLane } from "@/components/play/portability-lane";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { InfoTip } from "@/components/info-tip";
import { SystemPromptTip } from "@/components/play/config-help";

function initialRefs(): ModelRef[] {
  return [
    {
      id: newRefId(),
      provider: "webllm",
      model: PROVIDERS.webllm.defaultModel,
    },
    {
      id: newRefId(),
      provider: "webllm",
      model: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    },
  ];
}

export function PortabilityMode() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [refs, setRefs] = useState<ModelRef[]>(initialRefs);
  const [system, setSystem] = useState(SEED_SYSTEM);
  const [userMessage, setUserMessage] = useState(SEED_MESSAGE);
  const [temperature, setTemperature] = useState(0.7);
  const [assertions, setAssertions] = useState<Assertion[]>(SEED_ASSERTIONS);
  const [runsPerModel, setRunsPerModel] = useState(WEBLLM_RUNS_PER_MODEL);
  const [lanes, setLanes] = useState<LaneResult[]>([]);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const applyDraft = useCallback((draft: PortabilityDraft) => {
    setRefs(draft.refs);
    setSystem(draft.system);
    setUserMessage(draft.userMessage);
    setTemperature(draft.temperature);
    setAssertions(draft.assertions);
    setRunsPerModel(draft.runsPerModel);
    setLanes(draft.lanes);
    setReflectionNote(draft.reflection ?? "");
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/portability",
    kind: "portability",
    apply: applyDraft,
  });

  // A spec is only worth testing across vendors, so seed the roster with the
  // user's BYOK provider plus the free in-browser model — a genuinely
  // different family, which is what makes the matrix informative.
  const handleResolveProvider = useCallback(
    (provider: ProviderId, model: string) => {
      setRefs((prev) => {
        const next = [...prev];
        next[0] = { ...next[0], provider, model };
        return next;
      });
      setRunsPerModel(DEFAULT_RUNS_PER_MODEL);
    },
    [],
  );

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: handleResolveProvider,
  });

  const missingProvider = refs.find(
    (r) => providerNeedsKey(r.provider) && !keys[r.provider],
  )?.provider;
  const usesWebLLM = refs.some((r) => r.provider === "webllm");
  const webllmCount = refs.filter((r) => r.provider === "webllm").length;

  const report = useMemo(
    () => buildPortabilityReport(assertions, lanes),
    [assertions, lanes],
  );

  const scoredAssertions = useMemo(
    () => report.rows.map((r) => r.assertion),
    [report],
  );

  const costEstimate = estimateMatrixCost(
    refs,
    runsPerModel,
    system,
    userMessage,
  );
  const totalCalls = refs.length * runsPerModel;

  const completedLanes = lanes.filter((l) =>
    l.runs.some((r) => r.status === "done"),
  ).length;
  const showReflection =
    completedLanes >= 2 && !running && !reflectionDismissed && report.total > 0;

  function updateRun(
    refId: string,
    index: number,
    updater: (prev: LaneRun) => LaneRun,
  ) {
    setLanes((prev) =>
      prev.map((lane) =>
        lane.refId === refId
          ? {
              ...lane,
              runs: lane.runs.map((r, i) => (i === index ? updater(r) : r)),
            }
          : lane,
      ),
    );
  }

  async function runOne(ref: ModelRef, index: number) {
    const apiKey = keys[ref.provider];
    updateRun(ref.id, index, (prev) => ({ ...prev, status: "running" }));
    try {
      const stream = runChat({
        provider: ref.provider,
        model: ref.model,
        system,
        messages: [{ role: "user", content: userMessage }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateRun(ref.id, index, (prev) => ({
            ...prev,
            text: prev.text + event.delta,
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            ref.provider,
            ref.model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateRun(ref.id, index, (prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
          }));
          recordUsage({
            provider: ref.provider,
            model: ref.model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          updateRun(ref.id, index, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRun(ref.id, index, (prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }

  async function runMatrix() {
    if (missingProvider || !userMessage.trim()) return;
    setLanes(
      refs.map((ref) => ({
        refId: ref.id,
        runs: Array.from({ length: runsPerModel }, () => ({
          text: "",
          status: "idle" as const,
        })),
      })),
    );
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);

    const jobs = refs.flatMap((ref) =>
      Array.from({ length: runsPerModel }, (_, i) => ({ ref, index: i })),
    );
    // The in-browser engine serialises on one GPU context regardless, so the
    // pool exists to keep BYOK keys inside per-minute rate limits. Any webllm
    // model in the roster forces the whole matrix down to one at a time.
    const limit = usesWebLLM ? 1 : BYOK_CONCURRENCY;
    await runPool(jobs, limit, (job) => runOne(job.ref, job.index));
    setRunning(false);
  }

  function handleSave() {
    save({
      title: title.trim() || suggestTitle(system, "Untitled portability run"),
      refs,
      system,
      userMessage,
      temperature,
      assertions,
      runsPerModel,
      lanes,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !!missingProvider}
        providerName={missingProvider ? PROVIDERS[missingProvider].name : ""}
        action="run the matrix"
      />
      <WebLLMUnsupportedBanner show={usesWebLLM} />

      {webllmCount > 1 && (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4">
          <p className="font-sans text-[14px] leading-[1.5] text-ink">
            More than one in-browser model in the roster. They share a single
            GPU context, so each one has to download and load in turn — this
            will be slow, and switching between them evicts the previous
            model. Two different vendors is a better test of portability
            anyway.
          </p>
        </div>
      )}

      <ModelRoster
        refs={refs}
        onChange={setRefs}
        keyFor={(p) => !providerNeedsKey(p) || !!keys[p]}
      />

      {/* The spec under test — shared across every model on purpose. */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
            The spec — one system prompt, every model
            <InfoTip>{SystemPromptTip}</InfoTip>
          </span>
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={5}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
          />
        </label>

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

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            Temperature — {temperature.toFixed(2)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-[var(--highlight)]"
          />
        </label>
      </div>

      {/* Assertions — same idea as Spread, turned across models instead. */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
            Clauses
            <InfoTip>
              The same checkable claims as Spread, turned in a different
              direction: there you asked whether a clause survives resampling,
              here whether it survives a change of model. Checked in your
              browser, no extra calls.
            </InfoTip>
          </span>
          <button
            type="button"
            onClick={() =>
              setAssertions((prev) => [
                ...prev,
                { id: newId("a"), kind: "contains", value: "" },
              ])
            }
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            + Add
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {assertions.map((a) => (
            <AssertionRow
              key={a.id}
              assertion={a}
              canRemove={assertions.length > 1}
              onChange={(next) =>
                setAssertions((prev) =>
                  prev.map((x) => (x.id === a.id ? next : x)),
                )
              }
              onRemove={() =>
                setAssertions((prev) => prev.filter((x) => x.id !== a.id))
              }
            />
          ))}
        </div>
      </div>

      {/* Run controls */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            Runs per model
          </span>
          <select
            value={runsPerModel}
            onChange={(e) => setRunsPerModel(Number(e.target.value))}
            className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {RUNS_PER_MODEL.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {totalCalls} call{totalCalls === 1 ? "" : "s"}
          {costEstimate > 0 && (
            <>
              {" · ≈ "}
              {costEstimate < 0.01 ? "<$0.01" : `$${costEstimate.toFixed(3)}`}
            </>
          )}
        </span>

        {running && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink">
            Running…
          </span>
        )}

        <button
          type="button"
          onClick={runMatrix}
          disabled={running || !!missingProvider || !userMessage.trim()}
          className="ml-auto inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running ? "Running…" : "Run the matrix"}
        </button>

        {runsPerModel === 1 && (
          <p className="w-full font-mono text-[10px] leading-[1.6] text-ink-quiet">
            One run per model is the cheap version, and it can&apos;t tell an
            unreliable clause from a model-specific one. Three can.
          </p>
        )}
      </div>

      <PortabilityMatrix report={report} refs={refs} />

      {lanes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {refs.map((ref) => (
            <PortabilityLane
              key={ref.id}
              modelRef={ref}
              lane={lanes.find((l) => l.refId === ref.id)}
              assertions={scoredAssertions}
            />
          ))}
        </div>
      )}

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.portability}
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
        disabled={lanes.length === 0}
        artifact="Portability Report"
      />
    </div>
  );
}
