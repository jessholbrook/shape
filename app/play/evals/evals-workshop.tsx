"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftHydration } from "@/lib/hooks/use-draft-hydration";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_EVAL_SYSTEM_PROMPT,
  EMPTY_CASE_RESULT,
  SEED_CASES,
  SEED_CRITERIA,
  SCORE_MAX,
  aggregateScore,
  type CaseResult,
  type Criterion,
  type EvalCase,
  type Score,
} from "@/lib/evals";
import { saveDraft, suggestTitle, type EvalsDraft } from "@/lib/drafts";
import { RubricEditor } from "@/components/play/rubric-editor";
import { EvalCaseRow } from "@/components/play/eval-case-row";
import {
  DraftSaveBar,
  type DraftSaveStatus,
} from "@/components/play/draft-save-bar";

function emptyResults(cases: EvalCase[]): Record<string, CaseResult> {
  const out: Record<string, CaseResult> = {};
  for (const c of cases) out[c.id] = { ...EMPTY_CASE_RESULT, scores: {} };
  return out;
}

export function EvalsWorkshop() {
  const { keys, hydrated } = useKeys();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(PROVIDERS.anthropic.defaultModel);
  const [temperature, setTemperature] = useState(0.5);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_EVAL_SYSTEM_PROMPT);
  const [rubric, setRubric] = useState<Criterion[]>(SEED_CRITERIA);
  const [cases, setCases] = useState<EvalCase[]>(SEED_CASES);
  const [results, setResults] = useState<Record<string, CaseResult>>(() =>
    emptyResults(SEED_CASES),
  );
  const [running, setRunning] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hydrateFromDraft = useCallback((draft: EvalsDraft) => {
    setProvider(draft.provider);
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
    setTitle(draft.title);
    setDraftId(draft.id);
  }, []);
  useDraftHydration(initialDraftId, "evals", hydrateFromDraft);

  const ready = hydrated && !!keys[provider];

  const aggregate = useMemo(
    () => aggregateScore(rubric, cases, results),
    [rubric, cases, results],
  );

  function updateResult(id: string, updater: (prev: CaseResult) => CaseResult) {
    setResults((prev) => ({
      ...prev,
      [id]: updater(prev[id] ?? { ...EMPTY_CASE_RESULT, scores: {} }),
    }));
  }

  async function runOne(evalCase: EvalCase) {
    const apiKey = keys[provider];
    if (!apiKey) {
      updateResult(evalCase.id, () => ({
        ...EMPTY_CASE_RESULT,
        status: "error",
        error: `No key set for ${provider}.`,
        scores: {},
      }));
      return;
    }
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
    setSaveStatus("saving");
    const saved = saveDraft({
      id: draftId ?? undefined,
      kind: "evals",
      title:
        title.trim() ||
        suggestTitle(
          systemPrompt.split("\n")[0] ?? "",
          "Untitled eval workshop",
        ),
      provider,
      model,
      temperature,
      systemPrompt,
      rubric,
      cases,
      results,
    });
    setDraftId(saved.id);
    setTitle(saved.title);
    setSaveStatus("saved");
    if (!searchParams.get("draft")) {
      router.replace(`/play/evals?draft=${saved.id}`, { scroll: false });
    }
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {hydrated && !ready && (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[14px] text-ink">
            You&apos;re missing a key for{" "}
            <span className="font-mono text-[13px]">
              {PROVIDERS[provider].name}
            </span>
            . Add one to run the eval.
          </p>
          <Link
            href="/settings/keys"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Set up keys →
          </Link>
        </div>
      )}

      {/* Provider / model / temperature */}
      <div className="bg-surface border border-line rounded-[16px] p-5 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => {
              const next = e.target.value as ProviderId;
              setProvider(next);
              setModel(PROVIDERS[next].defaultModel);
            }}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {PROVIDER_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none"
          >
            {PROVIDERS[provider].models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Temperature — ${temperature.toFixed(2)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full accent-[var(--highlight)]"
          />
        </Field>
      </div>

      {/* System prompt */}
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          System prompt under test
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

      {/* Rubric editor */}
      <RubricEditor criteria={rubric} onChange={setRubric} />

      {/* Run row + scorecard */}
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

      {/* Case panel */}
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

      <DraftSaveBar
        title={title}
        onTitleChange={(next) => {
          setTitle(next);
          if (saveStatus === "saved") setSaveStatus("idle");
        }}
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      {children}
    </label>
  );
}
