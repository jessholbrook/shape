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
  AGENT_IDS,
  DEFAULT_RELAY,
  DEFAULT_RUNS_PER_SCENARIO,
  MAX_SCENARIOS,
  MAX_TOOLS,
  RUNS_PER_SCENARIO,
  SEED_POLICY,
  SEED_ROLE,
  SEED_SCENARIOS,
  SEED_TOOLS,
  agentById,
  buildAgencyReport,
  buildAgentMessages,
  buildRelayReport,
  composeIncoming,
  composeRelaySystemPrompt,
  composeSystemPrompt,
  estimateAgencyCost,
  estimateRelayCost,
  newAgencyId,
  parseRelayDecision,
  relayStatus,
  type RelayConfig,
  type RelayStep,
  type Scenario,
  type ScenarioResult,
  type ScenarioRun,
  type Tool,
} from "@/lib/agency";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { ToolEditor } from "@/components/play/tool-editor";
import { ScenarioCard, SoloRuns } from "@/components/play/scenario-card";
import { AgencyReportPanel } from "@/components/play/agency-report";
import { AgentPanel } from "@/components/play/agent-panel";
import { RelayReportPanel } from "@/components/play/relay-report";
import { RelayTrace } from "@/components/play/relay-trace";
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
  const [mode, setMode] = useState<"solo" | "relay">("solo");
  const [relay, setRelay] = useState<RelayConfig>(DEFAULT_RELAY);
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
    setMode(draft.relay ? "relay" : "solo");
    if (draft.relay) setRelay(draft.relay);
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
  const isRelay = mode === "relay";

  const systemPrompt = useMemo(
    () => composeSystemPrompt(role, tools, policy),
    [role, tools, policy],
  );

  /** One assembled prompt per agent, in AGENT_IDS order. */
  const relayPrompts = useMemo(
    () =>
      AGENT_IDS.map((id) => composeRelaySystemPrompt(id, tools, policy, relay)),
    [tools, policy, relay],
  );

  const report = useMemo(
    () => buildAgencyReport(scenarios, tools, results),
    [scenarios, tools, results],
  );

  const relayReport = useMemo(
    () => buildRelayReport(scenarios, tools, results, relay),
    [scenarios, tools, results, relay],
  );

  // A relay run is sequential by nature, and the in-browser engine already
  // runs one call at a time; several runs per scenario there reads as a hang.
  const effectiveRuns = isRelay && isWebLLM ? 1 : runsPerScenario;

  const costEstimate = isRelay
    ? estimateRelayCost(provider, model, relayPrompts, scenarios, effectiveRuns)
    : estimateAgencyCost(provider, model, systemPrompt, scenarios, effectiveRuns);
  const totalCalls = scenarios.length * effectiveRuns;
  const maxRelayCalls = totalCalls * relay.maxTurns;

  const scored = isRelay ? relayReport.scored : report.scored;
  const showReflection = scored >= 2 && !running && !reflectionDismissed;

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

  /**
   * One scenario, as a relay: the entry agent gets the user's message, and
   * each reply decides who speaks next until someone acts, someone reaches
   * the user, nobody can parse, or the turn budget runs out. The same
   * `relayStatus` table drives this loop and the grader, so the two can't
   * disagree about which asks reached the user.
   */
  async function runRelayScenario(scenario: Scenario, index: number) {
    const apiKey = keys[provider];
    const steps: RelayStep[] = [];
    const publish = (status: ScenarioRun["status"], error?: string) => {
      const done = steps.filter((s) => s.status === "done");
      updateRun(scenario.id, index, (prev) => ({
        ...prev,
        status,
        error,
        raw: steps[steps.length - 1]?.raw ?? "",
        trace: steps.map((s) => ({ ...s })),
        inputTokens: done.reduce((n, s) => n + (s.inputTokens ?? 0), 0),
        outputTokens: done.reduce((n, s) => n + (s.outputTokens ?? 0), 0),
        costUsd: done.reduce((n, s) => n + (s.costUsd ?? 0), 0),
      }));
    };

    let next = relayStatus(steps, relay);
    while (next.kind === "continue") {
      const agentId = next.nextAgentId;
      const prev = steps[steps.length - 1];
      const incoming = prev
        ? composeIncoming(
            agentById(relay, prev.agentId),
            parseRelayDecision(prev.raw),
            agentById(relay, agentId),
            relay,
          )
        : scenario.userMessage;
      const messages = buildAgentMessages(steps, agentId, incoming);
      const step: RelayStep = { agentId, incoming, raw: "", status: "running" };
      steps.push(step);
      publish("running");

      try {
        const stream = runChat({
          provider,
          model,
          system: composeRelaySystemPrompt(agentId, tools, policy, relay),
          messages,
          temperature,
          apiKey,
        });
        for await (const event of stream) {
          if (event.type === "text") {
            step.raw += event.delta;
            publish("running");
          } else if (event.type === "done") {
            step.status = "done";
            step.inputTokens = event.usage.inputTokens;
            step.outputTokens = event.usage.outputTokens;
            step.costUsd = calcCost(
              provider,
              model,
              event.usage.inputTokens,
              event.usage.outputTokens,
            );
            recordUsage({
              provider,
              model,
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
            });
          } else if (event.type === "error") {
            step.status = "error";
            step.error = event.message;
          }
        }
      } catch (err) {
        step.status = "error";
        step.error = err instanceof Error ? err.message : String(err);
      }

      if (step.status !== "done") {
        publish("error", step.error);
        return;
      }
      next = relayStatus(steps, relay);
    }
    publish("done");
  }

  async function runAll() {
    if (!keyReady || scenarios.length === 0) return;
    setResults(
      scenarios.map((s) => ({
        scenarioId: s.id,
        runs: Array.from({ length: effectiveRuns }, () => ({
          raw: "",
          status: "idle" as const,
        })),
      })),
    );
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    const jobs = scenarios.flatMap((scenario) =>
      Array.from({ length: effectiveRuns }, (_, i) => ({ scenario, index: i })),
    );
    await runPool(jobs, isWebLLM ? 1 : BYOK_CONCURRENCY, (job) =>
      isRelay
        ? runRelayScenario(job.scenario, job.index)
        : runScenario(job.scenario, job.index),
    );
    setRunning(false);
  }

  function switchMode(next: "solo" | "relay") {
    if (next === mode || running) return;
    setMode(next);
    // Solo replies have no trace and relay traces aren't solo replies —
    // a report built from the other mode's results would be a fiction.
    setResults([]);
    setReflectionDismissed(false);
  }

  function handleSave() {
    // In relay mode the solo role is unused; name the draft after the room.
    const seed = isRelay ? agentById(relay, relay.entryAgentId).role : role;
    save({
      title:
        title.trim() ||
        suggestTitle(seed, isRelay ? "Untitled relay" : "Untitled agency policy"),
      provider,
      model,
      temperature,
      role,
      policy,
      tools,
      scenarios,
      runsPerScenario,
      results,
      relay: isRelay ? relay : undefined,
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
          {isRelay ? (
            <>
              Two agents, one policy, the tools split between them — and the
              user talks to only one of them. Handoffs are prompted the same
              way the tools are, so you can read exactly what each agent was
              told. The format has four keywords; the small in-browser models
              will miss it sometimes, and &ldquo;No clear decision&rdquo; is
              the honest grade when they do.
            </>
          ) : (
            <>
              Tools are described in the prompt and the decision is read back
              out of the reply. Real products use their provider&apos;s tool
              API instead — the decision you&apos;re designing is the same
              one, and keeping the definitions in the prompt is what lets you
              edit them and watch the behaviour move.
            </>
          )}
        </p>
      </div>

      <div className="bg-surface border border-line rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5">
          <ModeButton
            active={!isRelay}
            disabled={running}
            onClick={() => switchMode("solo")}
          >
            Solo
          </ModeButton>
          <ModeButton
            active={isRelay}
            disabled={running}
            onClick={() => switchMode("relay")}
          >
            Relay
          </ModeButton>
        </div>
        <p className="font-mono text-[11px] leading-[1.5] text-ink-quiet max-w-md">
          {isRelay
            ? "Two agents in a room. Each is graded on its own, then the group is graded on what reached the user — and the gap between the two is the finding."
            : "One agent, one policy. Where does it draw the line between asking and acting?"}
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

      {isRelay && (
        <AgentPanel relay={relay} onChange={setRelay} disabled={running} />
      )}

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
              agents={isRelay ? relay.agents : undefined}
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
        {!isRelay && (
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
        )}
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
            {isRelay
              ? "Policy — one sentence, given to both agents"
              : "Policy — where the ask/act line sits"}
            <InfoTip>
              {isRelay ? (
                <>
                  Both agents read this sentence verbatim. The claim under
                  test is that it means different things depending on where
                  each of them sits — &ldquo;ask the user&rdquo; is about a
                  channel, and one of them doesn&apos;t have it.
                </>
              ) : (
                <>
                  The rule you want it to follow about when to proceed and
                  when to check. This is the sentence the whole playground is
                  testing.
                </>
              )}
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
            {showPrompt
              ? "Hide"
              : isRelay
                ? "What each agent reads"
                : "What the model reads"}{" "}
            ·{" "}
            <span className="text-ink-quiet">
              {isRelay
                ? relayPrompts.map((p) => p.length).join(" + ")
                : systemPrompt.length}{" "}
              chars
            </span>
          </button>
          {showPrompt && !isRelay && (
            <pre className="mt-2 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[320px] overflow-y-auto text-ink">
              {systemPrompt}
            </pre>
          )}
          {showPrompt && isRelay && (
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
              {AGENT_IDS.map((id, i) => (
                <div key={id} className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                    {agentById(relay, id).name}
                  </span>
                  <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[320px] overflow-y-auto text-ink">
                    {relayPrompts[i]}
                  </pre>
                </div>
              ))}
            </div>
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
            value={effectiveRuns}
            disabled={isRelay && isWebLLM}
            onChange={(e) => setRunsPerScenario(Number(e.target.value))}
            title={
              isRelay && isWebLLM
                ? "One run per scenario on the in-browser model — a relay is several calls in a row"
                : undefined
            }
            className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
          >
            {RUNS_PER_SCENARIO.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {isRelay
            ? `up to ${maxRelayCalls} calls`
            : `${totalCalls} call${totalCalls === 1 ? "" : "s"}`}
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

      {isRelay ? (
        <RelayReportPanel report={relayReport} config={relay} />
      ) : (
        <AgencyReportPanel report={report} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {scenarios.map((scenario) => {
          const soloRow = report.rows.find((r) => r.scenario.id === scenario.id);
          const relayRow = relayReport.rows.find(
            (r) => r.scenario.id === scenario.id,
          );
          return (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              tools={tools}
              canRemove={scenarios.length > 1}
              onChange={(next) =>
                setScenarios((prev) =>
                  prev.map((s) => (s.id === next.id ? next : s)),
                )
              }
              onRemove={() => {
                setScenarios((prev) => prev.filter((s) => s.id !== scenario.id));
                setResults((prev) =>
                  prev.filter((r) => r.scenarioId !== scenario.id),
                );
              }}
            >
              {isRelay
                ? relayRow && <RelayTrace row={relayRow} config={relay} />
                : soloRow && <SoloRuns row={soloRow} tools={tools} />}
            </ScenarioCard>
          );
        })}
      </div>

      {showReflection && (
        <ReflectionCard
          reflection={isRelay ? REFLECTION.agencyRelay : REFLECTION.agency}
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
