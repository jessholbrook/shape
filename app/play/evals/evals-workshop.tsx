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
  DEFAULT_EVAL_SYSTEM_PROMPT,
  EMPTY_CASE_RESULT,
  DESIGN_SETS,
  GENERATED_SET_ID,
  GENERATION_TEMPERATURE,
  SEED_CASES,
  SEED_CRITERIA,
  SCORE_MAX,
  aggregateScore,
  buildDesignReport,
  composeGenerationSystem,
  designSetById,
  emptyDesignScores,
  emptyGeneratedOutputs,
  emptyGeneratedSet,
  rankingComplete,
  rankingProblem,
  setFromGenerated,
  type CaseResult,
  type Criterion,
  type DesignScores,
  type DesignSet,
  type EvalCase,
  type EvalMode,
  type GeneratedSet,
  type Score,
} from "@/lib/evals";
import { suggestTitle, type EvalsDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import { InfoTip } from "@/components/info-tip";
import { SystemPromptTip } from "@/components/play/config-help";
import { RubricEditor } from "@/components/play/rubric-editor";
import { EvalCaseRow } from "@/components/play/eval-case-row";
import { DesignOutputCard } from "@/components/play/design-output-card";
import { CAREFUL_READER, DesignReportPanel, YOUR_RANKING } from "@/components/play/design-report";
import { GeneratorPanel } from "@/components/play/generator-panel";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ReflectionCard } from "@/components/play/reflection-card";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";

function emptyResults(cases: EvalCase[]): Record<string, CaseResult> {
  const out: Record<string, CaseResult> = {};
  for (const c of cases) out[c.id] = { ...EMPTY_CASE_RESULT, scores: {} };
  return out;
}

/** Hand scores, notes, and whether the truth is out — kept per set, so switching sets loses nothing. */
type DesignState = {
  scores: DesignScores;
  notes: Record<string, string>;
  revealed: boolean;
};

function emptyDesignState(set: DesignSet): DesignState {
  return { scores: emptyDesignScores(set), notes: {}, revealed: false };
}

export function EvalsWorkshop() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState<string>(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.5);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_EVAL_SYSTEM_PROMPT);
  const [rubric, setRubric] = useState<Criterion[]>(SEED_CRITERIA);
  const [cases, setCases] = useState<EvalCase[]>(SEED_CASES);
  const [results, setResults] = useState<Record<string, CaseResult>>(() =>
    emptyResults(SEED_CASES),
  );
  const [mode, setMode] = useState<EvalMode>("apply");
  const [designSetId, setDesignSetId] = useState<string>(DESIGN_SETS[0].id);
  const [designBySet, setDesignBySet] = useState<Record<string, DesignState>>({});
  const [generated, setGenerated] = useState<GeneratedSet>(() =>
    emptyGeneratedSet("webllm", PROVIDERS.webllm.defaultModel),
  );
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const hydrateFromDraft = useCallback((draft: EvalsDraft) => {
    setProvider(draft.provider);
    setReflectionNote(draft.reflection ?? "");
    setModel(draft.model);
    setTemperature(draft.temperature);
    setSystemPrompt(draft.systemPrompt);
    setRubric(draft.rubric);
    setCases(draft.cases);
    const filled: Record<string, CaseResult> = {};
    for (const c of draft.cases) {
      filled[c.id] = draft.results[c.id] ?? {
        ...EMPTY_CASE_RESULT,
        scores: {},
      };
    }
    setResults(filled);
    setMode(draft.mode ?? "apply");
    if (draft.design) {
      // The reader's own set travels with the draft; a draft that names a
      // seeded set we no longer ship lands on the default one.
      const own = draft.design.generated;
      const set = own ? setFromGenerated(own, draft.design.notes) : designSetById(draft.design.setId);
      if (own) setGenerated(own);
      setDesignSetId(set.id);
      setDesignBySet({
        [set.id]: {
          scores: { ...emptyDesignScores(set), ...draft.design.scores },
          notes: draft.design.notes ?? {},
          revealed: draft.design.revealed,
        },
      });
    }
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/evals",
    kind: "evals",
    apply: hydrateFromDraft,
  });

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: useCallback((p: ProviderId, m: string) => {
      setProvider(p);
      setModel(m);
      // The writer for a generated set follows the default until something is written.
      setGenerated((g) =>
        g.outputs.every((o) => o.status === "idle") ? { ...g, provider: p, model: m } : g,
      );
    }, []),
  });

  const ready = hydrated && (!providerNeedsKey(provider) || !!keys[provider]);

  const aggregate = useMemo(
    () => aggregateScore(rubric, cases, results),
    [rubric, cases, results],
  );

  const completedCases = useMemo(
    () => cases.filter((c) => results[c.id]?.status === "done").length,
    [cases, results],
  );
  const isDesign = mode === "design";
  const isGenerated = designSetId === GENERATED_SET_ID;
  const designSet = useMemo(
    () =>
      isGenerated
        ? setFromGenerated(generated, designBySet[GENERATED_SET_ID]?.notes)
        : designSetById(designSetId),
    [isGenerated, generated, designBySet, designSetId],
  );
  const designState = useMemo(
    () => designBySet[designSet.id] ?? emptyDesignState(designSet),
    [designBySet, designSet],
  );
  const { scores: designScores, notes: designNotes, revealed } = designState;
  const rankingDone = !isGenerated || rankingComplete(generated);
  const anyScore = Object.values(designScores).some((forOutput) =>
    Object.values(forOutput ?? {}).some((v) => typeof v === "number"),
  );
  const writtenCount = generated.outputs.filter((o) => o.status === "done").length;
  const generatedHasKey =
    hydrated && (!providerNeedsKey(generated.provider) || !!keys[generated.provider]);
  const designReport = useMemo(
    () => buildDesignReport(rubric, designSet, designScores),
    [rubric, designSet, designScores],
  );
  const showReflection = isDesign
    ? revealed && !reflectionDismissed
    : completedCases >= 2 && !running && !reflectionDismissed;

  function switchMode(next: EvalMode) {
    if (next === mode || running) return;
    setMode(next);
    setReflectionDismissed(false);
  }

  function switchSet(id: string) {
    if (id === designSet.id) return;
    setDesignSetId(id);
    setReflectionDismissed(false);
  }

  function updateDesign(updater: (prev: DesignState) => DesignState) {
    setDesignBySet((prev) => ({
      ...prev,
      [designSet.id]: updater(prev[designSet.id] ?? emptyDesignState(designSet)),
    }));
  }

  function setDesignScore(outputId: string, criterionId: string, score: Score | null) {
    setDirty(true);
    updateDesign((prev) => {
      const forOutput = { ...(prev.scores[outputId] ?? {}) };
      if (score === null) delete forOutput[criterionId];
      else forOutput[criterionId] = score;
      return { ...prev, scores: { ...prev.scores, [outputId]: forOutput } };
    });
  }

  function setDesignNote(outputId: string, note: string) {
    setDirty(true);
    updateDesign((prev) => ({ ...prev, notes: { ...prev.notes, [outputId]: note } }));
  }

  function reveal() {
    setDirty(true);
    updateDesign((prev) => ({ ...prev, revealed: true }));
  }

  function resetDesign() {
    updateDesign(() => emptyDesignState(designSet));
    if (isGenerated) setGenerated((g) => ({ ...g, ranks: {} }));
    setReflectionDismissed(false);
  }

  function setRank(outputId: string, rank: number | null) {
    setDirty(true);
    setGenerated((g) => {
      const ranks = { ...g.ranks };
      if (rank === null) delete ranks[outputId];
      else ranks[outputId] = rank;
      return { ...g, ranks };
    });
  }

  function updateGeneratedOutput(
    id: string,
    updater: (prev: GeneratedSet["outputs"][number]) => GeneratedSet["outputs"][number],
  ) {
    setGenerated((g) => ({
      ...g,
      outputs: g.outputs.map((o) => (o.id === id ? updater(o) : o)),
    }));
  }

  /** Four independent replies at temperature 1. Everything the reader had done on the old four is cleared. */
  async function generateSet() {
    const apiKey = keys[generated.provider];
    if (providerNeedsKey(generated.provider) && !apiKey) return;
    setGenerating(true);
    setDirty(true);
    setDesignBySet((prev) => {
      const next = { ...prev };
      delete next[GENERATED_SET_ID];
      return next;
    });
    setReflectionDismissed(false);
    const fresh = emptyGeneratedOutputs().map((o) => ({ ...o, status: "running" as const }));
    setGenerated((g) => ({ ...g, ranks: {}, outputs: fresh }));
    const system = composeGenerationSystem(generated.brief);
    await Promise.all(
      fresh.map(async (o) => {
        try {
          const stream = runChat({
            provider: generated.provider,
            model: generated.model,
            system,
            messages: [{ role: "user", content: generated.userMessage }],
            temperature: GENERATION_TEMPERATURE,
            apiKey,
          });
          for await (const event of stream) {
            if (event.type === "text") {
              updateGeneratedOutput(o.id, (prev) => ({ ...prev, text: prev.text + event.delta }));
            } else if (event.type === "done") {
              updateGeneratedOutput(o.id, (prev) => ({ ...prev, status: "done" }));
              recordUsage({
                provider: generated.provider,
                model: generated.model,
                inputTokens: event.usage.inputTokens,
                outputTokens: event.usage.outputTokens,
              });
            } else if (event.type === "error") {
              updateGeneratedOutput(o.id, (prev) => ({ ...prev, status: "error", error: event.message }));
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          updateGeneratedOutput(o.id, (prev) => ({ ...prev, status: "error", error: message }));
        }
      }),
    );
    setGenerating(false);
  }

  function updateResult(id: string, updater: (prev: CaseResult) => CaseResult) {
    setResults((prev) => ({
      ...prev,
      [id]: updater(prev[id] ?? { ...EMPTY_CASE_RESULT, scores: {} }),
    }));
  }

  async function runOne(evalCase: EvalCase) {
    const apiKey = keys[provider];
    if (providerNeedsKey(provider) && !apiKey) {
      updateResult(evalCase.id, () => ({
        ...EMPTY_CASE_RESULT,
        status: "error",
        error: `No key set for ${provider}.`,
        scores: {},
      }));
      return;
    }
    setDirty(true);
    updateResult(evalCase.id, () => ({
      ...EMPTY_CASE_RESULT,
      status: "running",
      startMs: Date.now(),
      scores: {},
    }));
    try {
      const stream = runChat({
        provider,
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: evalCase.userMessage }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateResult(evalCase.id, (prev) => ({
            ...prev,
            output: prev.output + event.delta,
          }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateResult(evalCase.id, (prev) => ({
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
          updateResult(evalCase.id, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateResult(evalCase.id, (prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    }
  }

  async function runAll() {
    setRunning(true);
    await Promise.all(cases.map((c) => runOne(c)));
    setRunning(false);
  }

  function resetResults() {
    setResults(emptyResults(cases));
    setDirty(false);
    setReflectionDismissed(false);
  }

  function setScore(caseId: string, criterionId: string, score: Score | null) {
    updateResult(caseId, (prev) => {
      const scores = { ...prev.scores };
      if (score === null) {
        delete scores[criterionId];
      } else {
        scores[criterionId] = score;
      }
      return { ...prev, scores };
    });
  }

  function setNote(caseId: string, note: string) {
    updateResult(caseId, (prev) => ({ ...prev, note }));
  }

  function handleSaveDraft() {
    save({
      title:
        title.trim() ||
        (isDesign
          ? `Rubric design — ${isGenerated ? "your own set" : designSet.title}`
          : suggestTitle(
              systemPrompt.split("\n")[0] ?? "",
              "Untitled eval workshop",
            )),
      provider,
      model,
      temperature,
      systemPrompt,
      rubric,
      cases,
      results,
      mode,
      design: isDesign
        ? {
            setId: designSet.id,
            scores: designScores,
            notes: designNotes,
            revealed,
            generated: isGenerated ? generated : undefined,
          }
        : undefined,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-line rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5">
          <ModeButton
            active={!isDesign}
            disabled={running}
            onClick={() => switchMode("apply")}
          >
            Apply a rubric
          </ModeButton>
          <ModeButton
            active={isDesign}
            disabled={running}
            onClick={() => switchMode("design")}
          >
            Design a rubric
          </ModeButton>
        </div>
        <p className="font-mono text-[11px] leading-[1.5] text-ink-quiet max-w-md">
          {isDesign
            ? "The outputs are fixed — some strong, some weak. Write criteria that separate them, score by hand, then see whether your rubric ranks them the way a careful reader does. No model needed."
            : "Your rubric is fixed; the outputs vary. Run the system prompt through the cases and score what comes back."}
        </p>
      </div>

      {!isDesign && (
        <>
          <MissingKeyBanner
            show={hydrated && !ready}
            providerName={PROVIDERS[provider].name}
            action="run the eval"
          />
          <WebLLMUnsupportedBanner show={provider === "webllm"} />

          {/* Provider / model / temperature */}
          <ProviderModelTempRow
            provider={provider}
            model={model}
            temperature={temperature}
            onProviderChange={setProvider}
            onModelChange={setModel}
            onTemperatureChange={setTemperature}
          />
        </>
      )}

      {isDesign && (
        <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
              The set — {isGenerated ? "your own" : designSet.title}
              <InfoTip>
                {isGenerated ? (
                  <>
                    A model writes four replies to your brief at temperature 1.
                    Rank them before you write a criterion — your ranking is
                    the truth the rubric is checked against, so the report can
                    only tell you whether the rubric measures what you used.
                  </>
                ) : (
                  <>
                    Four replies to one prompt, in no particular order. A careful
                    reader ranks them; you&apos;ll see that ranking, and the reasons,
                    after you&apos;ve scored. Try adding a criterion like
                    &ldquo;{designSet.hint}&rdquo; and watch which output it rewards.
                  </>
                )}
              </InfoTip>
            </span>
            <div
              role="group"
              aria-label="Set"
              className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5"
            >
              {DESIGN_SETS.map((s) => (
                <ModeButton
                  key={s.id}
                  active={s.id === designSetId}
                  disabled={generating}
                  onClick={() => switchSet(s.id)}
                >
                  {s.title}
                </ModeButton>
              ))}
              <ModeButton
                active={isGenerated}
                disabled={generating}
                onClick={() => switchSet(GENERATED_SET_ID)}
              >
                Your own
              </ModeButton>
            </div>
          </div>
          {isGenerated ? (
            <>
              <MissingKeyBanner
                show={hydrated && !generatedHasKey}
                providerName={PROVIDERS[generated.provider].name}
                action="write the replies"
              />
              <WebLLMUnsupportedBanner show={generated.provider === "webllm"} />
              <GeneratorPanel
                set={generated}
                onChange={(next) => {
                  setGenerated(next);
                  setDirty(true);
                }}
                hasKey={generatedHasKey}
                running={generating}
                onGenerate={generateSet}
              />
            </>
          ) : (
            <>
              <p className="font-sans text-[14px] leading-[1.55] text-ink-muted">
                {designSet.brief}
              </p>
              <p className="font-sans text-[14px] leading-[1.55] text-ink italic">
                &ldquo;{designSet.userMessage}&rdquo;
              </p>
            </>
          )}
        </div>
      )}

      {/* System prompt */}
      {!isDesign && (
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mb-2 inline-flex items-center gap-1.5">
          System prompt under test
          <InfoTip>{SystemPromptTip}</InfoTip>
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <p className="mt-2 font-mono text-[10px] text-ink-quiet">
          This is the system you&apos;re evaluating. Change it and rerun to
          see scores shift.
        </p>
      </div>
      )}

      {/* Rubric editor */}
      <RubricEditor criteria={rubric} onChange={setRubric} />

      {isDesign && (isGenerated ? writtenCount > 0 || generating : true) && (
        <>
          <div className="flex flex-col gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Outputs — {isGenerated ? `${writtenCount} written` : `${designSet.outputs.length} fixed`} ×{" "}
              {rubric.length} criteria
              {isGenerated && !rankingDone && writtenCount > 0 && (
                <span className="ml-2 text-highlight-ink">· rank them first</span>
              )}
            </p>
            {designSet.outputs.map((o) => (
              <DesignOutputCard
                key={o.id}
                output={o}
                criteria={rubric}
                scores={designScores[o.id] ?? {}}
                note={designNotes[o.id] ?? ""}
                revealed={revealed}
                onScore={(criterionId, score) => setDesignScore(o.id, criterionId, score)}
                onNoteChange={(note) => setDesignNote(o.id, note)}
                rank={
                  isGenerated
                    ? {
                        value: generated.ranks[o.id] ?? null,
                        count: writtenCount,
                        locked: anyScore,
                        onChange: (rank) => setRank(o.id, rank),
                      }
                    : undefined
                }
                truthLabel={isGenerated ? YOUR_RANKING.label : CAREFUL_READER.label}
                scoringLocked={
                  isGenerated && !rankingDone ? (rankingProblem(generated) ?? undefined) : undefined
                }
                notePlaceholder={
                  isGenerated
                    ? "Why you ranked it here — shown as the reason once you check."
                    : undefined
                }
              />
            ))}
            {isGenerated &&
              generated.outputs
                .filter((o) => o.status === "running" || o.status === "error")
                .map((o) => (
                  <div
                    key={o.id}
                    className="bg-surface border border-line rounded-[14px] p-4 md:p-5 flex flex-col gap-2"
                  >
                    <span className="font-display text-[16px] leading-[1.2] text-ink">{o.label}</span>
                    {o.status === "error" ? (
                      <p className="font-mono text-[12px] text-danger break-words">{o.error}</p>
                    ) : (
                      <p className="font-mono text-[13px] leading-[1.55] text-ink-muted whitespace-pre-wrap break-words">
                        {o.text || "Writing…"}
                      </p>
                    )}
                  </div>
                ))}
          </div>

          <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={reveal}
                disabled={
                  !designReport.fullyScored || revealed || !rankingDone || designSet.outputs.length < 2
                }
                className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
              >
                {revealed ? "Revealed" : "Check the rubric"}
                <span className="text-highlight">→</span>
              </button>
              <button
                type="button"
                onClick={resetDesign}
                className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                Reset
              </button>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {!rankingDone
                ? rankingProblem(generated)
                : designReport.fullyScored
                  ? revealed
                    ? "Scores stay editable — the report follows them."
                    : "Every output scored. Check when you're ready."
                  : "Score every output on every criterion first."}
            </span>
          </div>

          {revealed && (
            <DesignReportPanel
              report={designReport}
              lesson={designSet.lesson}
              truth={isGenerated ? YOUR_RANKING : CAREFUL_READER}
            />
          )}
        </>
      )}

      {/* Run row + scorecard */}
      {!isDesign && (
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runAll}
            disabled={!ready || running}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Running…" : "Run all cases"}
            <span className="text-highlight">→</span>
          </button>
          <button
            type="button"
            onClick={resetResults}
            disabled={running}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Reset
          </button>
        </div>
        <AggregateScorecard
          avg={aggregate.avg}
          max={rubric.length * SCORE_MAX}
          fullyScored={aggregate.fullyScoredCases}
          totalCases={cases.length}
        />
      </div>

      )}

      {/* Case panel */}
      {!isDesign && (
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Cases — {cases.length} prompts × {rubric.length} criteria
        </p>
        {cases.map((c, i) => (
          <EvalCaseRow
            key={c.id}
            num={i + 1}
            evalCase={c}
            criteria={rubric}
            result={results[c.id] ?? { ...EMPTY_CASE_RESULT, scores: {} }}
            onScore={(criterionId, score) => setScore(c.id, criterionId, score)}
            onNoteChange={(note) => setNote(c.id, note)}
          />
        ))}
      </div>
      )}

      {showReflection && (
        <ReflectionCard
          reflection={isDesign ? REFLECTION.evalsDesign : REFLECTION.evals}
          answer={reflectionNote}
          onAnswerChange={(v) => {
            setReflectionNote(v);
            setDirty(true);
          }}
          onDismiss={() => setReflectionDismissed(true)}
        />
      )}

      <DraftSaveBar
        artifact="Eval Rubric + Scorecard"
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}

function AggregateScorecard({
  avg,
  max,
  fullyScored,
  totalCases,
}: {
  avg: number | null;
  max: number;
  fullyScored: number;
  totalCases: number;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Average
      </span>
      <span className="font-display text-[24px] leading-none text-ink">
        {avg === null ? "—" : avg.toFixed(1)}
        <span className="text-ink-quiet">/{max}</span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {fullyScored} of {totalCases} fully scored
      </span>
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
