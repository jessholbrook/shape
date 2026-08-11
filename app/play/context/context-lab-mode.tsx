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
import { suggestTitle, type ContextDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import { BYOK_CONCURRENCY, runPool } from "@/lib/spread";
import {
  DEFAULT_RUNS_PER_SET,
  MAX_SETS,
  MIN_SETS,
  RUNS_PER_SET,
  SEED_QUESTION,
  SEED_SETS,
  SEED_SOURCES,
  SEED_SYSTEM,
  buildContextReport,
  composeUserTurn,
  estimateContextCost,
  newContextId,
  sourcesFor,
  type ContextSet,
  type SetResult,
  type SetRun,
  type Source,
} from "@/lib/context-lab";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { SourceEditor } from "@/components/play/source-editor";
import { ContextSetCard } from "@/components/play/context-set-card";
import { ContextReportPanel } from "@/components/play/context-report";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { InfoTip } from "@/components/info-tip";

export function ContextLabMode() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.3);
  const [system, setSystem] = useState(SEED_SYSTEM);
  const [question, setQuestion] = useState(SEED_QUESTION);
  const [sources, setSources] = useState<Source[]>(SEED_SOURCES);
  const [sets, setSets] = useState<ContextSet[]>(SEED_SETS);
  const [runsPerSet, setRunsPerSet] = useState(DEFAULT_RUNS_PER_SET);
  const [results, setResults] = useState<SetResult[]>([]);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const applyDraft = useCallback((draft: ContextDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setSystem(draft.system);
    setQuestion(draft.question);
    setSources(draft.sources);
    setSets(draft.sets);
    setRunsPerSet(draft.runsPerSet);
    setResults(draft.results);
    setReflectionNote(draft.reflection ?? "");
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/context",
    kind: "context",
    apply: applyDraft,
  });

  const handleResolveProvider = useCallback(
    (nextProvider: ProviderId, nextModel: string) => {
      setProvider(nextProvider);
      setModel(nextModel);
    },
    [],
  );

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: handleResolveProvider,
  });

  const keyReady = !providerNeedsKey(provider) || !!keys[provider];
  const isWebLLM = provider === "webllm";

  const report = useMemo(
    () => buildContextReport(sets, sources, results),
    [sets, sources, results],
  );

  const costEstimate = estimateContextCost(
    provider,
    model,
    system,
    sets,
    sources,
    question,
    runsPerSet,
  );
  const totalCalls = sets.length * runsPerSet;

  const showReflection =
    report.scored >= 2 && !running && !reflectionDismissed;

  function updateRun(
    setId: string,
    index: number,
    updater: (prev: SetRun) => SetRun,
  ) {
    setResults((prev) =>
      prev.map((r) =>
        r.setId === setId
          ? {
              ...r,
              runs: r.runs.map((run, i) => (i === index ? updater(run) : run)),
            }
          : r,
      ),
    );
  }

  function toggleSource(setId: string, sourceId: string) {
    setSets((prev) =>
      prev.map((s) =>
        s.id === setId
          ? {
              ...s,
              sourceIds: s.sourceIds.includes(sourceId)
                ? s.sourceIds.filter((id) => id !== sourceId)
                : [...s.sourceIds, sourceId],
            }
          : s,
      ),
    );
  }

  function renameSet(setId: string, label: string) {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, label } : s)),
    );
  }

  function removeSet(setId: string) {
    setSets((prev) => prev.filter((s) => s.id !== setId));
    setResults((prev) => prev.filter((r) => r.setId !== setId));
  }

  async function runSet(set: ContextSet, index: number) {
    const apiKey = keys[provider];
    const userTurn = composeUserTurn(sourcesFor(set, sources), question);
    updateRun(set.id, index, (prev) => ({ ...prev, status: "running" }));
    try {
      const stream = runChat({
        provider,
        model,
        system,
        messages: [{ role: "user", content: userTurn }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateRun(set.id, index, (prev) => ({
            ...prev,
            text: prev.text + event.delta,
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateRun(set.id, index, (prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
          }));
          recordUsage({
            provider,
            model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          updateRun(set.id, index, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRun(set.id, index, (prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }

  async function runAll() {
    if (!keyReady || !question.trim()) return;
    setResults(
      sets.map((s) => ({
        setId: s.id,
        runs: Array.from({ length: runsPerSet }, () => ({
          text: "",
          status: "idle" as const,
        })),
      })),
    );
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    const jobs = sets.flatMap((set) =>
      Array.from({ length: runsPerSet }, (_, i) => ({ set, index: i })),
    );
    await runPool(jobs, isWebLLM ? 1 : BYOK_CONCURRENCY, (job) =>
      runSet(job.set, job.index),
    );
    setRunning(false);
  }

  function handleSave() {
    save({
      title: title.trim() || suggestTitle(question, "Untitled context run"),
      provider,
      model,
      temperature,
      system,
      question,
      sources,
      sets,
      runsPerSet,
      results,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !keyReady}
        providerName={PROVIDERS[provider].name}
        action="run the context sets"
      />
      <WebLLMUnsupportedBanner show={isWebLLM} />

      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      {/* The instruction — deliberately small next to what follows. */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            System prompt
          </span>
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={3}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            The question — the same one for every set
          </span>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
          />
        </label>
      </div>

      {/* Sources */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
            Sources
            <InfoTip>
              Everything the model might be handed alongside the question —
              retrieved docs, pasted text, forwarded email. Mark each one by
              whether you&apos;d stand behind it; that&apos;s what turns
              &ldquo;the answer echoed this&rdquo; into a verdict.
            </InfoTip>
          </span>
          <button
            type="button"
            onClick={() =>
              setSources((prev) => [
                ...prev,
                {
                  id: newContextId("src"),
                  label: "New source",
                  kind: "trusted",
                  body: "",
                  tell: "",
                },
              ])
            }
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            + Add source
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {sources.map((s) => (
            <SourceEditor
              key={s.id}
              source={s}
              canRemove={sources.length > 1}
              onChange={(next) =>
                setSources((prev) =>
                  prev.map((x) => (x.id === s.id ? next : x)),
                )
              }
              onRemove={() => {
                setSources((prev) => prev.filter((x) => x.id !== s.id));
                // A removed source must not linger in any set's id list.
                setSets((prev) =>
                  prev.map((set) => ({
                    ...set,
                    sourceIds: set.sourceIds.filter((id) => id !== s.id),
                  })),
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Run controls */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            Runs per set
          </span>
          <select
            value={runsPerSet}
            onChange={(e) => setRunsPerSet(Number(e.target.value))}
            className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {RUNS_PER_SET.map((n) => (
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

        <button
          type="button"
          onClick={() =>
            setSets((prev) => [
              ...prev,
              {
                id: newContextId("set"),
                label: `Set ${prev.length + 1}`,
                sourceIds: [],
              },
            ])
          }
          disabled={sets.length >= MAX_SETS}
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add set
        </button>

        <button
          type="button"
          onClick={runAll}
          disabled={running || !keyReady || !question.trim()}
          className="ml-auto inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running ? "Running…" : "Run every set"}
        </button>

        {runsPerSet === 1 && (
          <p className="w-full font-mono text-[10px] leading-[1.6] text-ink-quiet">
            One run per set is enough to see the effect, not enough to trust
            its absence — a stale echo that happens sometimes may not show up
            here. Three runs catches more of it.
          </p>
        )}
      </div>

      <ContextReportPanel report={report} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.rows.map((row) => (
          <ContextSetCard
            key={row.set.id}
            row={row}
            allSources={sources}
            question={question}
            system={system}
            onToggleSource={(sourceId) => toggleSource(row.set.id, sourceId)}
            onRename={(label) => renameSet(row.set.id, label)}
            onRemove={() => removeSet(row.set.id)}
            canRemove={sets.length > MIN_SETS}
          />
        ))}
      </div>

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.context}
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
        disabled={results.length === 0}
        artifact="Context Map"
      />
    </div>
  );
}
