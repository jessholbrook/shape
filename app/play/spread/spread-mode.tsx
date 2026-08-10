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
import { suggestTitle, type SpreadDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import {
  DEFAULT_RUNS,
  RUN_COUNTS,
  SEED_ASSERTIONS,
  SEED_MESSAGE,
  SEED_SYSTEM,
  WEBLLM_DEFAULT_RUNS,
  buildReport,
  concurrencyFor,
  estimateRunCost,
  maxRunsFor,
  newId,
  rankRuns,
  runPool,
  type Assertion,
  type SpreadRun,
} from "@/lib/spread";
import { ConfigPanel, type ConfigState } from "@/components/play/config-panel";
import { AssertionRow } from "@/components/play/assertion-row";
import { SpreadRunCard } from "@/components/play/spread-run-card";
import { StabilityReportPanel } from "@/components/play/stability-report";
import { SpreadCompare } from "@/components/play/spread-compare";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { InfoTip } from "@/components/info-tip";

const INITIAL_CONFIG: ConfigState = {
  provider: "webllm",
  model: PROVIDERS.webllm.defaultModel,
  system: SEED_SYSTEM,
  temperature: 0.7,
};

function emptyRuns(count: number): SpreadRun[] {
  return Array.from({ length: count }, () => ({
    id: newId("run"),
    text: "",
    status: "idle" as const,
  }));
}

export function SpreadMode() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [config, setConfig] = useState<ConfigState>(INITIAL_CONFIG);
  const [userMessage, setUserMessage] = useState(SEED_MESSAGE);
  const [runCount, setRunCount] = useState(WEBLLM_DEFAULT_RUNS);
  const [assertions, setAssertions] = useState<Assertion[]>(SEED_ASSERTIONS);
  const [runs, setRuns] = useState<SpreadRun[]>([]);
  const [running, setRunning] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const applyDraft = useCallback((draft: SpreadDraft) => {
    setConfig({
      provider: draft.provider,
      model: draft.model,
      system: draft.systemPrompt,
      temperature: draft.temperature,
    });
    setUserMessage(draft.userMessage);
    setRunCount(draft.runCount);
    setAssertions(draft.assertions);
    setRuns(draft.runs);
    setReflectionNote(draft.reflection ?? "");
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/spread",
    kind: "spread",
    apply: applyDraft,
  });

  const handleResolveProvider = useCallback(
    (provider: ProviderId, model: string) => {
      setConfig((prev) => ({ ...prev, provider, model }));
      setRunCount(DEFAULT_RUNS);
    },
    [],
  );

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: handleResolveProvider,
  });

  const provider = config.provider;
  const maxRuns = maxRunsFor(provider);
  const isWebLLM = provider === "webllm";
  const keyReady = !providerNeedsKey(provider) || !!keys[provider];

  const report = useMemo(
    () => buildReport(assertions, runs),
    [assertions, runs],
  );

  const completed = runs.filter((r) => r.status === "done").length;
  const costEstimate = estimateRunCost(
    provider,
    config.model,
    config.system,
    userMessage,
    Math.min(runCount, maxRuns),
  );

  const showReflection =
    completed >= 2 && !running && !reflectionDismissed && report.total > 0;

  // Typicality is a whole-set property, so it's derived rather than stored:
  // ranking mid-stream would reshuffle cards on every token, and persisting
  // it would leave reopened drafts (and imports) with no ordering at all.
  const displayRuns = useMemo(
    () => (running ? runs : rankRuns(runs)),
    [runs, running],
  );

  // Cards are numbered by the order they were fired, not the order they're
  // displayed in, so "Run 3" means the same thing before and after ranking.
  const runNumber = useMemo(
    () => new Map(runs.map((r, i) => [r.id, i + 1])),
    [runs],
  );

  const comparePair = useMemo(() => {
    if (compare.length !== 2) return null;
    const a = runs.find((r) => r.id === compare[0]);
    const b = runs.find((r) => r.id === compare[1]);
    if (!a || !b || a.status !== "done" || b.status !== "done") return null;
    return { a, b };
  }, [compare, runs]);

  function updateRun(id: string, updater: (prev: SpreadRun) => SpreadRun) {
    setRuns((prev) => prev.map((r) => (r.id === id ? updater(r) : r)));
  }

  function changeProvider(next: ConfigState) {
    // Switching to the in-browser engine can put the run count above what it
    // can sensibly execute (it runs serially), so clamp on the way in.
    const clamped = Math.min(runCount, maxRunsFor(next.provider));
    if (clamped !== runCount) setRunCount(clamped);
    setConfig(next);
  }

  async function runOne(run: SpreadRun) {
    const apiKey = keys[provider];
    updateRun(run.id, (prev) => ({
      ...prev,
      text: "",
      error: undefined,
      status: "running",
      startMs: Date.now(),
      endMs: undefined,
    }));
    try {
      const stream = runChat({
        provider,
        model: config.model,
        system: config.system,
        messages: [{ role: "user", content: userMessage }],
        temperature: config.temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateRun(run.id, (prev) => ({
            ...prev,
            text: prev.text + event.delta,
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            config.model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateRun(run.id, (prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
            endMs: Date.now(),
          }));
          recordUsage({
            provider,
            model: config.model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          updateRun(run.id, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRun(run.id, (prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    }
  }

  async function runAll() {
    if (!keyReady) return;
    const count = Math.min(runCount, maxRuns);
    const fresh = emptyRuns(count);
    setRuns(fresh);
    setCompare([]);
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    // Concurrency is capped so BYOK keys stay inside per-minute rate limits,
    // and forced to 1 for the in-browser engine, which holds a single GPU
    // context and would otherwise queue opaquely inside the runtime.
    await runPool(fresh, concurrencyFor(provider), (run) => runOne(run));
    setRunning(false);
  }

  function toggleCompare(id: string) {
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  function handleSave() {
    save({
      title: title.trim() || suggestTitle(userMessage, "Untitled spread"),
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      systemPrompt: config.system,
      userMessage,
      runCount,
      runs,
      assertions,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !keyReady}
        providerName={PROVIDERS[provider].name}
        action="run the spread"
      />
      <WebLLMUnsupportedBanner show={isWebLLM} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ConfigPanel
          label="Config"
          config={config}
          onChange={changeProvider}
          connected={keyReady}
        />

        <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
              Assertions
              <InfoTip>
                Checkable claims about what your spec should guarantee. Each
                one is scored as a hit rate across every run — so a clause that
                passes four times out of ten shows up as a coin flip instead of
                a success. Checked in your browser; no extra model calls.
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
            {assertions.length === 0 && (
              <p className="font-mono text-[11px] text-ink-quiet leading-[1.6]">
                No assertions yet. Add one to score how often your spec
                actually holds.
              </p>
            )}
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
      </div>

      {/* Prompt + run controls */}
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
          <label className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              Runs
            </span>
            <select
              value={Math.min(runCount, maxRuns)}
              onChange={(e) => setRunCount(Number(e.target.value))}
              className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
            >
              {RUN_COUNTS.filter((n) => n <= maxRuns).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            {isWebLLM
              ? "Free · runs one at a time"
              : `≈ ${
                  costEstimate < 0.01
                    ? "<$0.01"
                    : `$${costEstimate.toFixed(3)}`
                } estimated`}
          </span>

          {running && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink">
              Run {Math.min(completed + 1, runs.length)} of {runs.length}
            </span>
          )}

          <button
            type="button"
            onClick={runAll}
            disabled={running || !keyReady || !userMessage.trim()}
            className="ml-auto inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Running…" : "Run the spread"}
          </button>
        </div>

        {isWebLLM && (
          <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
            The in-browser engine holds one GPU context, so runs execute
            sequentially — capped at {maxRuns} here. Bring a key for parallel
            runs and larger spreads.
          </p>
        )}
      </div>

      <StabilityReportPanel report={report} />

      {comparePair && (
        <SpreadCompare
          a={comparePair.a}
          b={comparePair.b}
          labelA={`Run ${runNumber.get(comparePair.a.id)}`}
          labelB={`Run ${runNumber.get(comparePair.b.id)}`}
          onClose={() => setCompare([])}
        />
      )}

      {runs.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              Runs
              {completed > 1 && !running && " · most typical first"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {compare.length === 0
                ? "Pick two runs to diff them"
                : compare.length === 1
                ? "Pick one more"
                : "Comparing"}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayRuns.map((run) => (
              <SpreadRunCard
                key={run.id}
                run={run}
                num={runNumber.get(run.id) ?? 0}
                assertions={report.results.map((r) => r.assertion)}
                selected={compare.includes(run.id)}
                selectable={compare.length < 2}
                onToggleSelect={() => toggleCompare(run.id)}
              />
            ))}
          </div>
        </div>
      )}

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.spread}
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
        disabled={runs.length === 0}
        artifact="Stability Report"
      />
    </div>
  );
}
