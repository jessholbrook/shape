"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { useDefaultProvider } from "@/lib/hooks/use-default-provider";
import { useUnsavedWork } from "@/lib/hooks/use-unsaved-work";
import { runChat, type ChatMessage } from "@/lib/providers/index";
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
  NATIVE_MAX_TOOL_TURNS,
  buildAgencyReport,
  buildAgentMessages,
  buildRelayReport,
  buildRepairReport,
  composeIncoming,
  composeNativeSystemPrompt,
  composeRelaySystemPrompt,
  composeScenarioIncoming,
  composeSystemPrompt,
  estimateAgencyCost,
  estimateRelayCost,
  newAgencyId,
  parseRelayDecision,
  rawFromRelayTurn,
  rawFromTurns,
  relayToolSpecs,
  relayStatus,
  stubFor,
  toolSpecs,
  withInjectedScenario,
  withSeedStubs,
  type Mechanism,
  type RelayConfig,
  type RelayStep,
  type Scenario,
  type ScenarioResult,
  type ScenarioRun,
  type Tool,
  type ToolTurn,
} from "@/lib/agency";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { ToolEditor } from "@/components/play/tool-editor";
import { ScenarioCard, SoloRuns } from "@/components/play/scenario-card";
import { AgencyReportPanel } from "@/components/play/agency-report";
import { AgentPanel } from "@/components/play/agent-panel";
import { RelayReportPanel } from "@/components/play/relay-report";
import { RepairReportPanel } from "@/components/play/repair-report";
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
  const [mechanism, setMechanism] = useState<Mechanism>("prompted");
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
    setMechanism(draft.mechanism ?? "prompted");
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
  // Native tool calling needs a provider with a tool API; the in-browser
  // models fall back to the prompted mechanism rather than failing every run.
  // In relay mode the mechanism applies to both agents: their own tools and
  // the handoff go through the API, the colleague directory stays in the prompt.
  const isNative = mechanism === "native" && !isWebLLM;

  const systemPrompt = useMemo(
    () => composeSystemPrompt(role, tools, policy),
    [role, tools, policy],
  );

  /** One assembled prompt per agent, in AGENT_IDS order. */
  const relayPrompts = useMemo(
    () =>
      AGENT_IDS.map((id) =>
        composeRelaySystemPrompt(id, tools, policy, relay, isNative ? "native" : "prompted"),
      ),
    [tools, policy, relay, isNative],
  );
  /** Each agent's tool list as the API receives it, in the native relay. */
  const relaySpecs = useMemo(
    () => AGENT_IDS.map((id) => relayToolSpecs(tools, id, relay)),
    [tools, relay],
  );

  const report = useMemo(
    () => buildAgencyReport(scenarios, tools, results),
    [scenarios, tools, results],
  );

  const relayReport = useMemo(
    () => buildRelayReport(scenarios, tools, results, relay),
    [scenarios, tools, results, relay],
  );

  const repairReport = useMemo(
    () => buildRepairReport(scenarios, results),
    [scenarios, results],
  );

  const nativeSystemPrompt = useMemo(
    () => composeNativeSystemPrompt(role, policy),
    [role, policy],
  );
  const nativeSpecs = useMemo(() => toolSpecs(tools), [tools]);

  // A relay run is sequential by nature, and the in-browser engine already
  // runs one call at a time; several runs per scenario there reads as a hang.
  const effectiveRuns = isRelay && isWebLLM ? 1 : runsPerScenario;

  const costEstimate = isRelay
    ? estimateRelayCost(provider, model, relayPrompts, scenarios, effectiveRuns)
    : isNative
      ? // A native run is the decision plus, when it acts, at least one more
        // call with the result fed back.
        estimateAgencyCost(provider, model, nativeSystemPrompt, scenarios, effectiveRuns) * 2
      : estimateAgencyCost(provider, model, systemPrompt, scenarios, effectiveRuns);
  const totalCalls = scenarios.length * effectiveRuns;
  const maxRelayCalls = totalCalls * relay.maxTurns;
  const maxNativeCalls = totalCalls * (NATIVE_MAX_TOOL_TURNS + 1);

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
        messages: [{ role: "user", content: composeScenarioIncoming(scenario) }],
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
            isNative ? "native" : "prompted",
            scenario,
          )
        : composeScenarioIncoming(scenario);
      const messages = buildAgentMessages(steps, agentId, incoming);
      const step: RelayStep = { agentId, incoming, raw: "", status: "running" };
      steps.push(step);
      publish("running");

      // In the native relay the reply arrives as text and tool calls; `raw`
      // is kept in the prompted format so the status table, the grader, and
      // the trace read both mechanisms the same way.
      const turn: Extract<ToolTurn, { kind: "assistant" }> = {
        kind: "assistant",
        text: "",
        calls: [],
        status: "running",
      };
      const syncRaw = () => {
        step.raw = isNative ? rawFromRelayTurn(turn, relay, agentId) : turn.text;
      };

      try {
        const stream = runChat({
          provider,
          model,
          system: composeRelaySystemPrompt(
            agentId,
            tools,
            policy,
            relay,
            isNative ? "native" : "prompted",
          ),
          messages,
          temperature,
          apiKey,
          ...(isNative ? { tools: relayToolSpecs(tools, agentId, relay) } : {}),
        });
        for await (const event of stream) {
          if (event.type === "text") {
            turn.text += event.delta;
            syncRaw();
            publish("running");
          } else if (event.type === "tool_call") {
            turn.calls.push(event.call);
            syncRaw();
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

  /**
   * One scenario through the provider's tool API. The first turn is the
   * decision — a tool call is an ACT — and every call gets its stub result
   * fed back, then the model speaks again. Up to NATIVE_MAX_TOOL_TURNS
   * rounds of results; a model still calling tools after that has kept
   * going without reporting back, which is its own finding.
   */
  async function runNativeScenario(scenario: Scenario, index: number) {
    const apiKey = keys[provider];
    const turns: ToolTurn[] = [];
    const messages: ChatMessage[] = [{ role: "user", content: composeScenarioIncoming(scenario) }];
    const publish = (status: ScenarioRun["status"], error?: string) => {
      const done = turns.filter(
        (t): t is Extract<ToolTurn, { kind: "assistant" }> =>
          t.kind === "assistant" && t.status === "done",
      );
      updateRun(scenario.id, index, (prev) => ({
        ...prev,
        status,
        error,
        raw: rawFromTurns(turns),
        turns: turns.map((t) => ({ ...t })),
        inputTokens: done.reduce((n, t) => n + (t.inputTokens ?? 0), 0),
        outputTokens: done.reduce((n, t) => n + (t.outputTokens ?? 0), 0),
        costUsd: done.reduce((n, t) => n + (t.costUsd ?? 0), 0),
      }));
    };

    for (let round = 0; ; round++) {
      const turn: Extract<ToolTurn, { kind: "assistant" }> = {
        kind: "assistant",
        text: "",
        calls: [],
        status: "running",
      };
      turns.push(turn);
      publish("running");

      try {
        const stream = runChat({
          provider,
          model,
          system: nativeSystemPrompt,
          messages,
          temperature,
          apiKey,
          tools: nativeSpecs,
        });
        for await (const event of stream) {
          if (event.type === "text") {
            turn.text += event.delta;
            publish("running");
          } else if (event.type === "tool_call") {
            turn.calls.push(event.call);
            publish("running");
          } else if (event.type === "done") {
            turn.status = "done";
            turn.inputTokens = event.usage.inputTokens;
            turn.outputTokens = event.usage.outputTokens;
            turn.costUsd = calcCost(
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
            turn.status = "error";
            turn.error = event.message;
          }
        }
      } catch (err) {
        turn.status = "error";
        turn.error = err instanceof Error ? err.message : String(err);
      }

      if (turn.status !== "done") {
        publish("error", turn.error);
        return;
      }
      if (turn.calls.length === 0) break;

      messages.push({ role: "assistant", content: turn.text, toolCalls: turn.calls });
      for (const call of turn.calls) {
        const { result, failure } = stubFor(tools, call);
        turns.push({ kind: "tool", callId: call.id, name: call.name, result, failure });
        messages.push({ role: "tool", toolCallId: call.id, name: call.name, content: result });
      }
      publish("running");
      if (round + 1 >= NATIVE_MAX_TOOL_TURNS) break;
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
        : isNative
          ? runNativeScenario(job.scenario, job.index)
          : runScenario(job.scenario, job.index),
    );
    setRunning(false);
  }

  function switchMechanism(next: Mechanism) {
    if (next === mechanism || running) return;
    setMechanism(next);
    // A fresh bench has no stubs; give the seed tools theirs so the first
    // native run has a failure to repair.
    if (next === "native") setTools((prev) => withSeedStubs(prev));
    setResults([]);
    setReflectionDismissed(false);
  }

  function switchMode(next: "solo" | "relay") {
    if (next === mode || running) return;
    setMode(next);
    // Relay's third experiment needs a document in the room; the seed's
    // retrieved notes join the scenarios the first time relay is opened.
    if (next === "relay") setScenarios((prev) => withInjectedScenario(prev));
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
      mechanism,
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
          {isRelay && isNative ? (
            <>
              Two agents, one policy, the tools split between them — and the
              user talks to only one of them. Each agent&apos;s own tools and
              the handoff go through the provider&apos;s tool API; what it
              knows about its colleague&apos;s tools stays in its prompt, as a
              directory. A run still ends at the first call — nothing is
              executed, and the repair loop stays in solo mode.
            </>
          ) : isRelay ? (
            <>
              Two agents, one policy, the tools split between them — and the
              user talks to only one of them. Handoffs are prompted the same
              way the tools are, so you can read exactly what each agent was
              told. The format has four keywords; the small in-browser models
              will miss it sometimes, and &ldquo;No clear decision&rdquo; is
              the honest grade when they do.
            </>
          ) : isNative ? (
            <>
              In the native mechanism the tools go through the provider&apos;s
              tool API instead of the prompt, and each call gets back the
              stub result you wrote — so the run keeps going. What the model
              does after a result that says the action failed is the point.
              The tool definitions still show below, as the API receives
              them.
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
        <div className="basis-full flex flex-wrap items-center gap-3 border-t border-line pt-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
              Mechanism
              <InfoTip>
                Prompted: the tools are described in the prompt and the
                decision is one line you can read. Native: the tools go
                through the provider&apos;s tool API — in solo mode the call
                gets a stub result back and the run continues, the mechanism
                for seeing repair; in relay mode the handoff is a tool too and
                the run ends at the first call. Native needs a provider with
                a key.
              </InfoTip>
            </span>
            <div className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5">
              <ModeButton
                active={!isNative}
                disabled={running}
                onClick={() => switchMechanism("prompted")}
              >
                Prompted
              </ModeButton>
              <ModeButton
                active={isNative}
                disabled={running || isWebLLM}
                onClick={() => switchMechanism("native")}
              >
                Native
              </ModeButton>
            </div>
            <span className="font-mono text-[10px] text-ink-quiet">
              {isWebLLM
                ? "Native tool calling needs a provider with a key."
                : isNative
                  ? isRelay
                    ? "Tools and the handoff go through the tool API; ASK and ANSWER stay as text."
                    : `Results are fed back for up to ${NATIVE_MAX_TOOL_TURNS} rounds.`
                  : "The decision is one line in the reply."}
            </span>
          </div>
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
              stubs={isNative}
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
                : isNative
                  ? `${nativeSystemPrompt.length} + ${JSON.stringify(nativeSpecs).length}`
                  : systemPrompt.length}{" "}
              chars
            </span>
          </button>
          {showPrompt && !isRelay && !isNative && (
            <pre className="mt-2 font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[320px] overflow-y-auto text-ink">
              {systemPrompt}
            </pre>
          )}
          {showPrompt && isNative && !isRelay && (
            <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  System prompt — no tool block
                </span>
                <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[320px] overflow-y-auto text-ink">
                  {nativeSystemPrompt}
                </pre>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  Tools — as the API receives them
                </span>
                <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[320px] overflow-y-auto text-ink">
                  {JSON.stringify(nativeSpecs, null, 2)}
                </pre>
              </div>
            </div>
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
                  {isNative && (
                    <>
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mt-2">
                        Tools — as the API receives them
                      </span>
                      <pre className="font-mono text-[11px] leading-[1.5] whitespace-pre-wrap break-words bg-canvas border border-line rounded-[8px] p-3 max-h-[240px] overflow-y-auto text-ink">
                        {JSON.stringify(relaySpecs[i], null, 2)}
                      </pre>
                    </>
                  )}
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
            : isNative
              ? `up to ${maxNativeCalls} calls`
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
      {isNative && <RepairReportPanel report={repairReport} />}

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
