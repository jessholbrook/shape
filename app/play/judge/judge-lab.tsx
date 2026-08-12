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
import { suggestTitle, type JudgeDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import { BYOK_CONCURRENCY, runPool } from "@/lib/spread";
import {
  MAX_PAIRS,
  MIN_PAIRS,
  SEED_CRITERIA,
  SEED_PAIRS,
  buildJudgeReport,
  composeJudgeSystem,
  composeJudgeTurn,
  estimateJudgeCost,
  newJudgeId,
  type JudgeRun,
  type Order,
  type Pair,
  type PairResult,
} from "@/lib/judge";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { PairEditor } from "@/components/play/pair-editor";
import { JudgeReportPanel } from "@/components/play/judge-report";
import { JudgePairCard } from "@/components/play/judge-pair-card";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { InfoTip } from "@/components/info-tip";

const ORDERS: Order[] = ["ab", "ba"];

export function JudgeLab() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.2);
  const [criteria, setCriteria] = useState(SEED_CRITERIA);
  const [pairs, setPairs] = useState<Pair[]>(SEED_PAIRS);
  const [results, setResults] = useState<PairResult[]>([]);
  const [running, setRunning] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const applyDraft = useCallback((draft: JudgeDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setCriteria(draft.criteria);
    setPairs(draft.pairs);
    setResults(draft.results);
    setReflectionNote(draft.reflection ?? "");
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/judge",
    kind: "judge",
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

  const judgeSystem = useMemo(() => composeJudgeSystem(criteria), [criteria]);
  const report = useMemo(
    () => buildJudgeReport(pairs, results),
    [pairs, results],
  );

  const costEstimate = estimateJudgeCost(provider, model, judgeSystem, pairs);
  const totalCalls = pairs.length * 2;

  const showReflection =
    report.scored >= 2 && !running && !reflectionDismissed;

  function updateRun(
    pairId: string,
    order: Order,
    updater: (prev: JudgeRun) => JudgeRun,
  ) {
    setResults((prev) =>
      prev.map((r) =>
        r.pairId === pairId
          ? {
              ...r,
              runs: r.runs.map((run) =>
                run.order === order ? updater(run) : run,
              ),
            }
          : r,
      ),
    );
  }

  async function runOne(pair: Pair, order: Order) {
    const apiKey = keys[provider];
    updateRun(pair.id, order, (prev) => ({ ...prev, status: "running" }));
    try {
      const stream = runChat({
        provider,
        model,
        system: judgeSystem,
        messages: [{ role: "user", content: composeJudgeTurn(pair, order) }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateRun(pair.id, order, (prev) => ({
            ...prev,
            raw: prev.raw + event.delta,
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateRun(pair.id, order, (prev) => ({
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
          updateRun(pair.id, order, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRun(pair.id, order, (prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }

  async function runAll() {
    if (!keyReady || pairs.length === 0) return;
    setResults(
      pairs.map((p) => ({
        pairId: p.id,
        runs: ORDERS.map((order) => ({
          order,
          raw: "",
          status: "idle" as const,
        })),
      })),
    );
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    const jobs = pairs.flatMap((pair) =>
      ORDERS.map((order) => ({ pair, order })),
    );
    await runPool(jobs, isWebLLM ? 1 : BYOK_CONCURRENCY, (job) =>
      runOne(job.pair, job.order),
    );
    setRunning(false);
  }

  function handleSave() {
    save({
      title: title.trim() || suggestTitle(criteria, "Untitled judge"),
      provider,
      model,
      temperature,
      criteria,
      pairs,
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
        action="run the judge"
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

      {/* The judge itself */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
            What the judge is told to care about
            <InfoTip>
              Your rubric from Eval Lab, turned into an instruction. Vague
              criteria are the usual reason a judge falls back on surface
              features like length.
            </InfoTip>
          </span>
          <textarea
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            rows={4}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
          />
        </label>

        <div>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            {showPrompt ? "Hide" : "What the judge reads"} ·{" "}
            <span className="text-ink-quiet">{judgeSystem.length} chars</span>
          </button>
          {showPrompt && (
            <pre className="mt-2 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[280px] overflow-y-auto text-ink">
              {judgeSystem}
            </pre>
          )}
        </div>
      </div>

      {/* Pairs */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
            Comparisons
            <InfoTip>
              Two candidate answers to the same request. In the seeded set the
              shorter answer is the better one every time — if the judge has a
              length bias, that&apos;s where it shows.
            </InfoTip>
          </span>
          <button
            type="button"
            disabled={pairs.length >= MAX_PAIRS}
            onClick={() =>
              setPairs((prev) => [
                ...prev,
                {
                  id: newJudgeId("pair"),
                  label: `Pair ${prev.length + 1}`,
                  prompt: "",
                  a: "",
                  b: "",
                  humanPick: null,
                },
              ])
            }
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
          >
            + Add pair
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {pairs.map((p) => (
            <PairEditor
              key={p.id}
              pair={p}
              canRemove={pairs.length > MIN_PAIRS}
              onChange={(next) =>
                setPairs((prev) =>
                  prev.map((x) => (x.id === p.id ? next : x)),
                )
              }
              onRemove={() => {
                setPairs((prev) => prev.filter((x) => x.id !== p.id));
                setResults((prev) => prev.filter((r) => r.pairId !== p.id));
              }}
            />
          ))}
        </div>
      </div>

      {/* Run controls */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {totalCalls} call{totalCalls === 1 ? "" : "s"} — each pair judged
          both ways
          {costEstimate > 0 && (
            <>
              {" · ≈ "}
              {costEstimate < 0.01 ? "<$0.01" : `$${costEstimate.toFixed(3)}`}
            </>
          )}
        </span>

        <button
          type="button"
          onClick={runAll}
          disabled={running || !keyReady || pairs.length === 0}
          className="ml-auto inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running ? "Judging…" : "Run the judge"}
        </button>
      </div>

      <JudgeReportPanel report={report} />

      <div className="flex flex-col gap-4">
        {report.rows
          .filter((r) => r.runs.length > 0)
          .map((row) => (
            <JudgePairCard key={row.pair.id} row={row} />
          ))}
      </div>

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.judge}
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
        artifact="Calibrated Judge"
      />
    </div>
  );
}
