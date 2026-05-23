"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_REFUSAL_GUIDELINES,
  EMPTY_RESULT,
  SEED_PROBES,
  evaluateMatch,
  type Probe,
  type ProbeResult,
  type ProbeVerdict,
} from "@/lib/refusal";
import { getDraft, saveDraft, suggestTitle } from "@/lib/drafts";
import { ProbeRow } from "@/components/play/probe-row";
import {
  DraftSaveBar,
  type DraftSaveStatus,
} from "@/components/play/draft-save-bar";

function emptyResults(probes: Probe[]): Record<string, ProbeResult> {
  const out: Record<string, ProbeResult> = {};
  for (const p of probes) out[p.id] = { ...EMPTY_RESULT };
  return out;
}

export function RefusalLab() {
  const { keys, hydrated } = useKeys();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(PROVIDERS.anthropic.defaultModel);
  const [temperature, setTemperature] = useState(0.3);
  const [guidelines, setGuidelines] = useState(DEFAULT_REFUSAL_GUIDELINES);
  const [probes, setProbes] = useState<Probe[]>(SEED_PROBES);
  const [results, setResults] = useState<Record<string, ProbeResult>>(() =>
    emptyResults(SEED_PROBES),
  );
  const [running, setRunning] = useState(false);

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [title, setTitle] = useState("");
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedDraftIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialDraftId || hydratedDraftIdRef.current === initialDraftId) {
      return;
    }
    const draft = getDraft(initialDraftId);
    if (draft && draft.kind === "refusal") {
      setProvider(draft.provider);
      setModel(draft.model);
      setTemperature(draft.temperature);
      setGuidelines(draft.guidelines);
      setProbes(draft.probes);
      // Fill in any missing per-probe slots so rendering is always safe.
      const filled: Record<string, ProbeResult> = {};
      for (const p of draft.probes) {
        filled[p.id] = draft.results[p.id] ?? { ...EMPTY_RESULT };
      }
      setResults(filled);
      setTitle(draft.title);
      setDraftId(draft.id);
      hydratedDraftIdRef.current = draft.id;
    }
  }, [initialDraftId]);

  const ready = hydrated && !!keys[provider];

  const score = useMemo(() => {
    let matched = 0;
    let scored = 0;
    for (const probe of probes) {
      const verdict = results[probe.id]?.verdict ?? null;
      const status = evaluateMatch(probe.expected, verdict);
      if (status !== "pending") scored += 1;
      if (status === "match") matched += 1;
    }
    return { matched, scored, total: probes.length };
  }, [probes, results]);

  function updateResult(id: string, updater: (prev: ProbeResult) => ProbeResult) {
    setResults((prev) => ({ ...prev, [id]: updater(prev[id]) }));
  }

  async function runOne(probe: Probe) {
    const apiKey = keys[provider];
    if (!apiKey) {
      updateResult(probe.id, () => ({
        ...EMPTY_RESULT,
        status: "error",
        error: `No key set for ${provider}.`,
      }));
      return;
    }
    updateResult(probe.id, () => ({
      output: "",
      status: "running",
      startMs: Date.now(),
      verdict: undefined,
    }));
    try {
      const stream = runChat({
        provider,
        model,
        system: guidelines,
        messages: [{ role: "user", content: probe.userMessage }],
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateResult(probe.id, (prev) => ({
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
          updateResult(probe.id, (prev) => ({
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
          updateResult(probe.id, (prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateResult(probe.id, (prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    }
  }

  async function runAll() {
    setRunning(true);
    await Promise.all(probes.map((p) => runOne(p)));
    setRunning(false);
  }

  function resetResults() {
    setResults(emptyResults(probes));
  }

  function setVerdict(probeId: string, verdict: ProbeVerdict | null) {
    updateResult(probeId, (prev) => ({
      ...prev,
      verdict: verdict ?? undefined,
    }));
  }

  function handleSaveDraft() {
    setSaveStatus("saving");
    const saved = saveDraft({
      id: draftId ?? undefined,
      kind: "refusal",
      title:
        title.trim() ||
        suggestTitle(guidelines.split("\n")[0] ?? "", "Untitled refusal lab"),
      provider,
      model,
      temperature,
      guidelines,
      probes,
      results,
    });
    setDraftId(saved.id);
    setTitle(saved.title);
    setSaveStatus("saved");
    if (!searchParams.get("draft")) {
      router.replace(`/play/refusal?draft=${saved.id}`, { scroll: false });
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
            . Add one to run the panel.
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

      {/* Guidelines editor */}
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          Refusal guidelines (system prompt)
        </label>
        <textarea
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          rows={8}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <p className="mt-2 font-mono text-[10px] text-ink-quiet">
          These become the model&apos;s system prompt for every probe. Edit
          them to design how the model handles each boundary.
        </p>
      </div>

      {/* Run row + scorecard */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runAll}
            disabled={!ready || running}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Running…" : "Run all probes"}
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
        <Scorecard {...score} />
      </div>

      {/* Probe panel */}
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Probe panel — {probes.length} cases
        </p>
        {probes.map((p, i) => (
          <ProbeRow
            key={p.id}
            num={i + 1}
            probe={p}
            result={results[p.id] ?? EMPTY_RESULT}
            onVerdict={(v) => setVerdict(p.id, v)}
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

function Scorecard({
  matched,
  scored,
  total,
}: {
  matched: number;
  scored: number;
  total: number;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Scorecard
      </span>
      <span className="font-display text-[24px] leading-none text-ink">
        {matched}
        <span className="text-ink-quiet">/{total}</span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        match
        {scored < total && (
          <>
            {" · "}
            <span>
              {total - scored} {total - scored === 1 ? "probe" : "probes"}{" "}
              unscored
            </span>
          </>
        )}
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
