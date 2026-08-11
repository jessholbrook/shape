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
import { suggestTitle, type AgencyDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import { BYOK_CONCURRENCY, runPool } from "@/lib/spread";
import {
  DEFAULT_RUNS_PER_SCENARIO,
  MAX_SCENARIOS,
  MAX_TOOLS,
  RUNS_PER_SCENARIO,
  SEED_POLICY,
  SEED_ROLE,
  SEED_SCENARIOS,
  SEED_TOOLS,
  buildAgencyReport,
  composeSystemPrompt,
  estimateAgencyCost,
  newAgencyId,
  type Scenario,
  type ScenarioResult,
  type ScenarioRun,
  type Tool,
} from "@/lib/agency";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { ToolEditor } from "@/components/play/tool-editor";
import { ScenarioCard } from "@/components/play/scenario-card";
import { AgencyReportPanel } from "@/components/play/agency-report";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { InfoTip } from "@/components/info-tip";

export function ToolBench() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.2);
  const [role, setRole] = useState(SEED_ROLE);
  const [policy, setPolicy] = useState(SEED_POLICY);
  const [tools, setTools] = useState<Tool[]>(SEED_TOOLS);
  const [scenarios, setScenarios] = useState<Scenario[]>(SEED_SCENARIOS);
  const [runsPerScenario, setRunsPerScenario] = useState(
    DEFAULT_RUNS_PER_SCENARIO,
  );
  const [results, setResults] = useState<ScenarioResult[]>([]);
  const [running, setRunning] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const applyDraft = useCallback((draft: AgencyDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setRole(draft.role);
    setPolicy(draft.policy);
    setTools(draft.tools);
    setScenarios(draft.scenarios);
    setRunsPerScenario(draft.runsPerScenario);
    setResults(draft.results);
    setReflectionNote(draft.reflection ?? "");
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/tools",
    kind: "agency",
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

  const systemPrompt = useMemo(
    () => composeSystemPrompt(role, tools, policy),
    [role, tools, policy],
  );

  const report = useMemo(
    () => buildAgencyReport(scenarios, tools, results),
    [scenarios, tools, results],
  );

  const costEstimate = estimateAgencyCost(
    provider,
    model,
    systemPrompt,
    scenarios,
    runsPerScenario,
  );
  const totalCalls = scenarios.length * runsPerScenario;

  const showReflection =
    report.scored >= 2 && !running && !reflectionDismissed;

  function updateRun(
    scenarioId: string,
    index: number,
    updater: (prev: ScenarioRun) => ScenarioRun,
  ) {
    setResults((prev) =>
      prev.map((r) =>
        r.scenarioId === scenarioId
          ? {
              ...r,
              runs: r.runs.map((run, i) => (i === index ? updater(run) : run)),
            }
          : r,
      ),
    );
  }

  async function runScenario(scenario: Scenario, index: number) {
    const apiKey = keys[provider];
    updateRun(scenario.id, index, (prev) => ({ ...prev, status: "running" }));
    try {
      const stream = runChat({
        provider,
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: scenario.userMessage }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateRun(scenario.id, index, (prev) => ({
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
          updateRun(scenario.id, index, (prev) => ({
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
          updateRun(scenario.id, index, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRun(scenario.id, index, (prev) => ({
        ...prev,
        status: "error",
        error: message,
      }));
    }
  }

  async function runAll() {
    if (!keyReady || scenarios.length === 0) return;
    setResults(
      scenarios.map((s) => ({
        scenarioId: s.id,
        runs: Array.from({ length: runsPerScenario }, () => ({
          raw: "",
          status: "idle" as const,
        })),
      })),
    );
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    const jobs = scenarios.flatMap((scenario) =>
      Array.from({ length: runsPerScenario }, (_, i) => ({ scenario, index: i })),
    );
    await runPool(jobs, isWebLLM ? 1 : BYOK_CONCURRENCY, (job) =>
      runScenario(job.scenario, job.index),
    );
    setRunning(false);
  }

  function handleSave() {
    save({
      title: title.trim() || suggestTitle(role, "Untitled agency policy"),
      provider,
      model,
      temperature,
      role,
      policy,
      tools,
      scenarios,
      runsPerScenario,
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
        action="run the scenarios"
      />
      <WebLLMUnsupportedBanner show={isWebLLM} />

      <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4">
        <p className="font-sans text-[14px] leading-[1.5] text-ink">
          <strong>Nothing here is executed.</strong>{" "}
          Tools are described in the prompt and the decision is read back out
          of the reply. Real products use their provider&apos;s tool API
          instead — the decision you&apos;re designing is the same one, and
          keeping the definitions in the prompt is what lets you edit them and
          watch the behaviour move.
        </p>
      </div>

      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      {/* Tools */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
            Tools
            <InfoTip>
              What the assistant can do. The description is the only thing the
              model knows about each one — the risk level is your judgement and
              the model never sees it.
            </InfoTip>
          </span>
          <button
            type="button"
            disabled={tools.length >= MAX_TOOLS}
            onClick={() =>
              setTools((prev) => [
                ...prev,
                {
                  id: newAgencyId("tool"),
                  name: "new_tool",
                  params: "arg",
                  description: "",
                  risk: "safe",
                },
              ])
            }
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
          >
            + Add tool
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {tools.map((t) => (
            <ToolEditor
              key={t.id}
              tool={t}
              canRemove={tools.length > 1}
              onChange={(next) =>
                setTools((prev) =>
                  prev.map((x) => (x.id === t.id ? next : x)),
                )
              }
              onRemove={() => {
                setTools((prev) => prev.filter((x) => x.id !== t.id));
                // A removed tool must not stay as some scenario's expectation.
                setScenarios((prev) =>
                  prev.map((s) =>
                    s.expectedToolId === t.id
                      ? { ...s, expectedToolId: undefined }
                      : s,
                  ),
                );
              }}
            />
          ))}
        </div>
      </div>

      {/* Role + policy */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            Role
          </span>
          <textarea
            value={role}
            onChange={(e) => setRole(e.target.value)}
            rows={2}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
            Policy — where the ask/act line sits
            <InfoTip>
              The rule you want it to follow about when to proceed and when to
              check. This is the sentence the whole playground is testing.
            </InfoTip>
          </span>
          <textarea
            value={policy}
            onChange={(e) => setPolicy(e.target.value)}
            rows={2}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
          />
        </label>

        <div>
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            {showPrompt ? "Hide" : "What the model reads"} ·{" "}
            <span className="text-ink-quiet">
              {systemPrompt.length} chars
            </span>
          </button>
          {showPrompt && (
            <pre className="mt-2 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[320px] overflow-y-auto text-ink">
              {systemPrompt}
            </pre>
          )}
        </div>
      </div>

      {/* Run controls */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            Runs per scenario
          </span>
          <select
            value={runsPerScenario}
            onChange={(e) => setRunsPerScenario(Number(e.target.value))}
            className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {RUNS_PER_SCENARIO.map((n) => (
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
          disabled={scenarios.length >= MAX_SCENARIOS}
          onClick={() =>
            setScenarios((prev) => [
              ...prev,
              {
                id: newAgencyId("sc"),
                label: `Scenario ${prev.length + 1}`,
                userMessage: "",
                expected: "ask",
              },
            ])
          }
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add scenario
        </button>

        <button
          type="button"
          onClick={runAll}
          disabled={running || !keyReady || scenarios.length === 0}
          className="ml-auto inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running ? "Running…" : "Run every scenario"}
        </button>
      </div>

      <AgencyReportPanel report={report} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.rows.map((row) => (
          <ScenarioCard
            key={row.scenario.id}
            row={row}
            tools={tools}
            canRemove={scenarios.length > 1}
            onChange={(next) =>
              setScenarios((prev) =>
                prev.map((s) => (s.id === next.id ? next : s)),
              )
            }
            onRemove={() => {
              setScenarios((prev) =>
                prev.filter((s) => s.id !== row.scenario.id),
              );
              setResults((prev) =>
                prev.filter((r) => r.scenarioId !== row.scenario.id),
              );
            }}
          />
        ))}
      </div>

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.agency}
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
        artifact="Agency Policy"
      />
    </div>
  );
}
