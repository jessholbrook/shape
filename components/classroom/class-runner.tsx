"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyze, type Experiment, type ExperimentRun, type LabModel } from "@/lib/experiment";
import { designFor } from "@/lib/classroom";
import { estimateExperimentCost, planRuns, runExperiment } from "@/lib/lab-runner";
import { runChat } from "@/lib/providers/index";
import { recordUsage } from "@/lib/usage";
import { PROVIDERS, providerNeedsKey, type ProviderId } from "@/lib/providers";
import { useKeys } from "@/lib/hooks/use-keys";
import { ProviderOptions } from "@/components/play/provider-options";
import { ModelSelect } from "@/components/play/model-select";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { Findings, ResultsTable, RunList } from "@/components/lab/results";
import { INPUT, Label, PANEL, PanelHeader } from "@/components/lab/fields";

type Status = { freeTier: boolean; status: string | null; classRemaining: number; memberRemaining: number };
type Submitted = { stored: number; recorded: number };
type Saved = { model: LabModel; runs: ExperimentRun[]; submitted: Submitted | null };

const storageKey = (code: string) => `shape:class-runs:${code}`;

function load(code: string): Saved | null {
  try {
    const v = JSON.parse(localStorage.getItem(storageKey(code)) ?? "null");
    return v && Array.isArray(v.runs) && v.model ? v : null;
  } catch {
    return null;
  }
}

function save(code: string, s: Saved) {
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(s));
  } catch {
    // Blocked storage: the runs are still saved to the class.
  }
}

/**
 * A student runs the class's experiment. The design is the teacher's and
 * fixed; the student picks only the answering model. Runs go to the class
 * when they finish, and stay in this browser so a reload shows them.
 */
export function ClassRunner({ code, experiment }: { code: string; experiment: Experiment }) {
  const { keys, hydrated } = useKeys();
  const router = useRouter();
  const [model, setModel] = useState<LabModel>(experiment.base.model);
  const [runs, setRuns] = useState<ExperimentRun[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [submitted, setSubmitted] = useState<Submitted | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshStatus = useCallback(() => {
    fetch(`/api/classes/${code}/status`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Status | null) => s && setStatus(s))
      .catch(() => {});
  }, [code]);

  // Restore this browser's last run of this class, once, after hydration.
  useEffect(() => {
    const s = load(code);
    if (s) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
      setModel(s.model);
      setRuns(s.runs);
      setSubmitted(s.submitted);
    }
    refreshStatus();
  }, [code, refreshStatus]);

  const design = useMemo(() => designFor(experiment, model), [experiment, model]);
  const withRuns = useMemo(() => ({ ...design, runs }), [design, runs]);
  const analysis = useMemo(() => analyze(withRuns), [withRuns]);
  const estimate = useMemo(() => estimateExperimentCost(design), [design]);

  const providers = useMemo(() => {
    const set = new Set<ProviderId>([model.provider]);
    for (const c of design.conditions) if (c.patch.model) set.add(c.patch.model.provider);
    for (const m of design.measures) if (m.kind === "classify" || m.kind === "rate") set.add(m.judge.provider);
    return [...set];
  }, [design, model.provider]);
  const missing = hydrated ? providers.find((p) => providerNeedsKey(p) && !keys[p]) : undefined;
  const freeOff = estimate.hostedCalls > 0 && status !== null && !status.freeTier;
  const overQuota = estimate.hostedCalls > 0 && !!status?.freeTier && estimate.hostedCalls > Math.min(status.memberRemaining, status.classRemaining);
  const closed = status?.status === "closed";
  const canRun = hydrated && !running && !missing && !freeOff && !overQuota && !closed;
  const done = runs.filter((r) => r.status === "done" || r.status === "error").length;

  async function submit(model: LabModel, finished: ExperimentRun[]) {
    setSubmitError(null);
    try {
      const res = await fetch(`/api/classes/${code}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, runs: finished }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't save your runs to the class.");
      setSubmitted(body);
      save(code, { model, runs: finished, submitted: body });
      // Pull the class's pooled results again, now with these runs in them.
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save your runs to the class.");
      save(code, { model, runs: finished, submitted: null });
    }
  }

  async function run() {
    if (!canRun) return;
    if (runs.length && !window.confirm("Run again? Your new runs replace the ones you sent to the class.")) return;
    const planned = planRuns(design);
    setRuns(planned);
    setSubmitted(null);
    setSubmitError(null);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let latest = planned;
    const onRun = (r: ExperimentRun) => {
      latest = latest.map((x) => (x.id === r.id ? r : x));
      setRuns(latest);
    };
    try {
      await runExperiment(design, planned, {
        runChat,
        keyFor: (p) => keys[p],
        onRun,
        signal: controller.signal,
        record: recordUsage,
        classCode: code,
      });
    } finally {
      const finished = latest.filter((r) => r.status === "done" || r.status === "error");
      setRuns(finished);
      setRunning(false);
      abortRef.current = null;
      refreshStatus();
      if (finished.length) await submit(model, finished);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className={PANEL} aria-label="Run it" data-testid="class-runner">
        <PanelHeader
          num="Run"
          title="Run it"
          hint="The experiment is your teacher's and can't be changed. Pick the model that answers; your runs go to the class when they finish."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
          <div>
            <Label htmlFor="class-provider">Provider</Label>
            <select
              id="class-provider"
              value={model.provider}
              disabled={running}
              onChange={(ev) => {
                const provider = ev.target.value as ProviderId;
                setModel({ provider, model: PROVIDERS[provider].defaultModel });
              }}
              className={`${INPUT} font-mono text-[13px]`}
            >
              <ProviderOptions current={model.provider} />
            </select>
          </div>
          <div>
            <Label htmlFor="class-model">Model</Label>
            <ModelSelect
              provider={model.provider}
              model={model.model}
              onChange={(m) => setModel({ provider: model.provider, model: m })}
              className={`${INPUT} font-mono text-[13px]`}
              ariaLabel="Model"
            />
          </div>
        </div>
        {model.provider !== "shape-free" && (
          <p className="font-sans text-[13px] leading-[1.5] text-ink-muted">
            Runs on your own key go straight from this browser to the provider, so Shape can&apos;t see them. They&apos;ll count
            in the class as <em>reported by you</em> rather than <em>recorded by Shape</em>.
          </p>
        )}
        <MissingKeyBanner show={!!missing} providerName={missing ? PROVIDERS[missing].name : ""} action="run this experiment" />
        <WebLLMUnsupportedBanner show={providers.includes("webllm")} />
        <p className="font-sans text-[14px] text-ink-muted" data-testid="class-preflight">
          {design.conditions.length} conditions × {Math.max(1, design.items.length)} {design.items.length === 1 ? "item" : "items"} × {design.n} runs →{" "}
          <span className="text-ink">{estimate.calls} calls</span>
          {estimate.hostedCalls > 0 && status?.freeTier && ` · from the class's free runs (you have ${Math.min(status.memberRemaining, status.classRemaining)} left today)`}
        </p>
        {freeOff && <p className="font-sans text-[13px] text-warning">Shape&apos;s free tier is off right now. Pick a model you have a key for.</p>}
        {overQuota && (
          <p className="font-sans text-[13px] text-warning">
            This needs {estimate.hostedCalls} free runs and you have {Math.min(status!.memberRemaining, status!.classRemaining)} left today. Try again
            tomorrow, or use your own key.
          </p>
        )}
        {closed && <p className="font-sans text-[13px] text-warning">This class is closed.</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Running…" : runs.length ? "Run again" : "Run experiment"} <span className="text-highlight">→</span>
          </button>
          {running && (
            <>
              <button type="button" onClick={() => abortRef.current?.abort()} className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink">
                Stop
              </button>
              <span className="font-mono text-[12px] tabular-nums text-ink-muted" aria-live="polite">
                {done} / {runs.length} answers
              </span>
            </>
          )}
        </div>
        {submitted && (
          <p className="bg-highlight-soft border border-highlight/40 rounded-[12px] px-4 py-3 font-sans text-[14px] text-ink" data-testid="class-submitted">
            Sent {submitted.stored} {submitted.stored === 1 ? "run" : "runs"} to the class
            {submitted.recorded > 0 && ` — ${submitted.recorded === submitted.stored ? "all" : submitted.recorded} recorded by Shape, so nobody can edit those answers or scores`}.
          </p>
        )}
        {submitError && (
          <p role="alert" className="font-sans text-[13px] text-danger">
            {submitError}{" "}
            <button type="button" onClick={() => submit(model, runs)} className="underline decoration-highlight underline-offset-4">
              Try again
            </button>
          </p>
        )}
      </section>

      {runs.some((r) => r.status === "done") && !running && (
        <>
          <Findings experiment={withRuns} analysis={analysis} />
          <ResultsTable experiment={withRuns} analysis={analysis} />
          <RunList experiment={withRuns} />
        </>
      )}
    </div>
  );
}
