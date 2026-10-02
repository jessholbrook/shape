"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { useDefaultProvider } from "@/lib/hooks/use-default-provider";
import { useUnsavedWork } from "@/lib/hooks/use-unsaved-work";
import { runChat } from "@/lib/providers/index";
import { recordUsage } from "@/lib/usage";
import { PROVIDERS, providerNeedsKey, type ProviderId } from "@/lib/providers";
import { maxRunsFor, RUN_COUNTS } from "@/lib/spread";
import type { ExperimentDraft } from "@/lib/drafts";
import {
  analyze,
  canonicalJson,
  starterExperiment,
  templateVars,
  type Experiment,
  type ExperimentRun,
  type LabModel,
  type Runner,
} from "@/lib/experiment";
import { estimateExperimentCost, planRuns, runExperiment } from "@/lib/lab-runner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { INPUT, Label, MONO_INPUT, PANEL, PanelHeader } from "@/components/lab/fields";
import { ConditionsEditor, ItemsEditor, MeasuresEditor } from "@/components/lab/setup";
import { Findings, ManifestPanel, ResultsTable, RunList } from "@/components/lab/results";

const INITIAL_MODEL: LabModel = { provider: "webllm", model: PROVIDERS.webllm.defaultModel };

/** Everything that determines what gets run — runs themselves excluded. */
function designKey(e: Experiment): string {
  const { base, conditions, items, n, measures } = e;
  return canonicalJson({ base, conditions, items, n, measures });
}

function runnerFor(provider: ProviderId): Runner {
  if (provider === "webllm") return "webllm";
  if (provider === "custom") return "custom";
  return "byok";
}

export function LabWorkshop() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  // A fixed timestamp keeps the server and hydration renders identical; real
  // times are stamped on run and save.
  const [experiment, setExperiment] = useState<Experiment>(() => starterExperiment(INITIAL_MODEL, 0));
  const [ranDesign, setRanDesign] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useUnsavedWork(dirty);

  const edit = useCallback((patch: Partial<Experiment>) => {
    setExperiment((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const applyDraft = useCallback((draft: ExperimentDraft) => {
    setExperiment(draft.experiment);
    setRanDesign(draft.experiment.runs.length ? designKey(draft.experiment) : null);
  }, []);

  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/lab",
    kind: "experiment",
    apply: applyDraft,
  });

  /** Changing the run model carries any judge that was following it. */
  const setModel = useCallback((next: LabModel) => {
    setExperiment((prev) => {
      const old = prev.base.model;
      const follows = (m: LabModel) => m.provider === old.provider && m.model === old.model;
      return {
        ...prev,
        base: { ...prev.base, model: next },
        measures: prev.measures.map((m) =>
          (m.kind === "classify" || m.kind === "rate") && follows(m.judge) ? { ...m, judge: next } : m,
        ),
      };
    });
  }, []);

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: useCallback((provider: ProviderId, model: string) => setModel({ provider, model }), [setModel]),
  });

  const e = experiment;
  const locked = running;
  const vars = useMemo(() => templateVars(e), [e]);
  const analysis = useMemo(() => analyze(e), [e]);
  const estimate = useMemo(() => estimateExperimentCost(e), [e]);
  const maxRuns = maxRunsFor(e.base.model.provider);
  const runCounts = RUN_COUNTS.filter((n) => n <= maxRuns);

  // Every provider this run touches — the answering model and each judge.
  const providers = useMemo(() => {
    const set = new Set<ProviderId>([e.base.model.provider]);
    for (const c of e.conditions) if (c.patch.model) set.add(c.patch.model.provider);
    for (const m of e.measures) if (m.kind === "classify" || m.kind === "rate") set.add(m.judge.provider);
    return [...set];
  }, [e]);
  const missing = hydrated ? providers.find((p) => providerNeedsKey(p) && !keys[p]) : undefined;
  const incomplete =
    !e.question.trim() ||
    e.measures.some(
      (m) =>
        (m.kind === "classify" && (!m.question.trim() || m.labels.length < 2)) ||
        (m.kind === "rate" && !m.rubric.trim()) ||
        (m.kind === "regex" && !m.pattern.trim()),
    );
  const canRun = hydrated && !missing && !running && !incomplete;
  const stale = e.runs.length > 0 && ranDesign !== null && ranDesign !== designKey(e);
  const done = e.runs.filter((r) => r.status === "done" || r.status === "error").length;

  async function run() {
    if (!canRun) return;
    if (e.runs.length && !window.confirm("Run again? This replaces the current runs.")) return;
    const now = Date.now();
    const design: Experiment = {
      ...e,
      n: Math.min(e.n, maxRuns),
      hypothesisLockedAt: e.hypothesisLockedAt ?? now,
      updatedAt: now,
    };
    const planned = planRuns(design);
    setExperiment({ ...design, runs: planned });
    setRanDesign(designKey(design));
    setRunning(true);
    setDirty(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const onRun = (r: ExperimentRun) =>
      setExperiment((prev) => ({ ...prev, runs: prev.runs.map((x) => (x.id === r.id ? r : x)) }));
    try {
      await runExperiment(design, planned, {
        runChat,
        keyFor: (p) => keys[p],
        onRun,
        signal: controller.signal,
        record: recordUsage,
      });
    } finally {
      // Runs that never started stay out of the analysis rather than counting as failures.
      setExperiment((prev) => ({ ...prev, runs: prev.runs.filter((r) => r.status !== "idle") }));
      setRunning(false);
      abortRef.current = null;
    }
  }

  function handleSave() {
    const now = Date.now();
    const name = title.trim() || e.title.trim() || "Untitled experiment";
    save({ title: name, experiment: { ...e, title: name, createdAt: e.createdAt || now, updatedAt: now } });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <DraftSaveBar
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSave}
        disabled={running}
        artifact="Experiment"
      />

      {/* 01 — Question */}
      <section className={PANEL} aria-label="Question and hypothesis">
        <PanelHeader num="01" title="The question" hint="What do you want to know about how the model behaves? Write the hypothesis before you run — afterwards it's locked, so the result can't quietly rewrite it." />
        <div>
          <Label htmlFor="lab-question">Question</Label>
          <textarea id="lab-question" rows={2} value={e.question} disabled={locked} onChange={(ev) => edit({ question: ev.target.value })} className={`${INPUT} resize-y`} />
        </div>
        <div>
          <Label htmlFor="lab-hypothesis">Hypothesis{e.hypothesisLockedAt ? " — locked" : ""}</Label>
          <textarea
            id="lab-hypothesis"
            rows={2}
            value={e.hypothesis}
            readOnly={!!e.hypothesisLockedAt}
            disabled={locked}
            onChange={(ev) => edit({ hypothesis: ev.target.value })}
            className={`${INPUT} resize-y ${e.hypothesisLockedAt ? "bg-surface text-ink-muted" : ""}`}
          />
          {e.hypothesisLockedAt && (
            <p className="font-sans text-[12px] text-ink-quiet mt-1.5">
              Locked when you first ran it — that&apos;s what makes it a hypothesis. Duplicate the draft in your notebook to start a new one.
            </p>
          )}
        </div>
      </section>

      {/* 02 — Setup */}
      <section className={PANEL} aria-label="Setup">
        <PanelHeader num="02" title="Setup" hint="What every condition starts from." />
        <ProviderModelTempRow
          provider={e.base.model.provider}
          model={e.base.model.model}
          temperature={e.base.temperature}
          onProviderChange={(provider) => setModel({ provider, model: PROVIDERS[provider].defaultModel })}
          onModelChange={(model) => setModel({ provider: e.base.model.provider, model })}
          onTemperatureChange={(temperature) => edit({ base: { ...e.base, temperature } })}
        />
        <div>
          <Label htmlFor="lab-system">System prompt</Label>
          <textarea id="lab-system" rows={3} value={e.base.system} disabled={locked} onChange={(ev) => edit({ base: { ...e.base, system: ev.target.value } })} className={MONO_INPUT} />
        </div>
        <div>
          <Label htmlFor="lab-user">User message</Label>
          <textarea id="lab-user" rows={2} value={e.base.userTemplate} disabled={locked} onChange={(ev) => edit({ base: { ...e.base, userTemplate: ev.target.value } })} className={MONO_INPUT} />
          {vars.length > 0 && (
            <p className="font-mono text-[11px] text-ink-quiet mt-1.5">
              Variables: {vars.map((v) => `{{${v}}}`).join(", ")} — filled from the items below.
            </p>
          )}
        </div>
      </section>

      <ConditionsEditor conditions={e.conditions} locked={locked} onChange={(conditions) => edit({ conditions })} />
      <ItemsEditor items={e.items} vars={vars} locked={locked} onChange={(items) => edit({ items })} />
      <MeasuresEditor measures={e.measures} locked={locked} defaultJudge={e.base.model} onChange={(measures) => edit({ measures })} />

      {/* 06 — Run */}
      <section className={PANEL} aria-label="Run">
        <PanelHeader num="06" title="Run it" />
        <MissingKeyBanner show={!!missing} providerName={missing ? PROVIDERS[missing].name : ""} action="run this experiment" />
        <WebLLMUnsupportedBanner show={providers.includes("webllm")} />
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <Label htmlFor="lab-n">Runs per cell</Label>
            <select
              id="lab-n"
              value={Math.min(e.n, maxRuns)}
              disabled={locked}
              onChange={(ev) => edit({ n: Number(ev.target.value) })}
              className={`${INPUT} w-auto`}
            >
              {runCounts.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <p className="font-sans text-[14px] text-ink-muted pb-2" data-testid="lab-preflight">
            {e.conditions.length} conditions × {Math.max(1, e.items.length)} {e.items.length === 1 ? "item" : "items"} × {Math.min(e.n, maxRuns)} runs →{" "}
            <span className="text-ink">{estimate.calls} calls</span>
            {" · "}
            {estimate.free ? "free, one at a time" : estimate.usd < 0.01 ? "under 1¢" : `about $${estimate.usd.toFixed(2)}`}
          </p>
        </div>
        {incomplete && (
          <p className="font-sans text-[13px] text-warning">
            Fill in the question, and every judge measure&apos;s question or rubric, before running.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Running…" : e.runs.length ? "Run again" : "Run experiment"}
            <span className="text-highlight">→</span>
          </button>
          {running && (
            <>
              <button type="button" onClick={() => abortRef.current?.abort()} className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink">
                Stop
              </button>
              <span className="font-mono text-[12px] tabular-nums text-ink-muted" aria-live="polite">
                {done} / {e.runs.length} answers
              </span>
            </>
          )}
        </div>
      </section>

      {stale && (
        <p role="status" className="bg-highlight-soft border border-highlight/40 rounded-[12px] px-4 py-3 font-sans text-[14px] text-ink">
          The setup has changed since these runs. The results below are for the old setup — run again to test the new one.
        </p>
      )}

      {e.runs.some((r) => r.status === "done") && (
        <>
          <Findings experiment={e} analysis={analysis} />
          <ResultsTable experiment={e} analysis={analysis} />
          <RunList experiment={e} />
          <ManifestPanel experiment={e} runner={runnerFor(e.base.model.provider)} />
        </>
      )}
    </div>
  );
}
