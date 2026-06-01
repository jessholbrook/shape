"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDERS, providerNeedsKey, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_REFUSAL_GUIDELINES,
  EMPTY_RESULT,
  SEED_PROBES,
  evaluateMatch,
  type Probe,
  type ProbeResult,
  type ProbeVerdict,
} from "@/lib/refusal";
import { suggestTitle, type RefusalDraft } from "@/lib/drafts";
import { ProbeRow } from "@/components/play/probe-row";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";

function emptyResults(probes: Probe[]): Record<string, ProbeResult> {
  const out: Record<string, ProbeResult> = {};
  for (const p of probes) out[p.id] = { ...EMPTY_RESULT };
  return out;
}

export function RefusalLab() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState<string>(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.3);
  const [guidelines, setGuidelines] = useState(DEFAULT_REFUSAL_GUIDELINES);
  const [probes, setProbes] = useState<Probe[]>(SEED_PROBES);
  const [results, setResults] = useState<Record<string, ProbeResult>>(() =>
    emptyResults(SEED_PROBES),
  );
  const [running, setRunning] = useState(false);

  const hydrateFromDraft = useCallback((draft: RefusalDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setGuidelines(draft.guidelines);
    setProbes(draft.probes);
    const filled: Record<string, ProbeResult> = {};
    for (const p of draft.probes) {
      filled[p.id] = draft.results[p.id] ?? { ...EMPTY_RESULT };
    }
    setResults(filled);
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/refusal",
    kind: "refusal",
    apply: hydrateFromDraft,
  });

  const ready = hydrated && (!providerNeedsKey(provider) || !!keys[provider]);

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
    if (providerNeedsKey(provider) && !apiKey) {
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
    save({
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
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !ready}
        providerName={PROVIDERS[provider].name}
        action="run the panel"
      />

      {/* Provider / model / temperature */}
      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

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
        onTitleChange={setTitle}
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

