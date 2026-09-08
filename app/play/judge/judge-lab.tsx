"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { useDefaultProvider } from "@/lib/hooks/use-default-provider";
import { useUnsavedWork } from "@/lib/hooks/use-unsaved-work";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { BYOK_PROVIDERS, PROVIDERS, providerNeedsKey, type ProviderId } from "@/lib/providers";
import { modelName } from "@/lib/live-models";
import { suggestTitle, type JudgeDraft } from "@/lib/drafts";
import { REFLECTION } from "@/lib/reflection-questions";
import { BYOK_CONCURRENCY, runPool } from "@/lib/spread";
import {
  DEFAULT_FILLER,
  LENGTH_LABEL,
  MAX_PAIRS,
  MIN_PAIRS,
  SEED_CRITERIA,
  SEED_PAIRS,
  SELF_JUDGE_TEMPERATURE,
  VERDICT_LABEL,
  buildJudgeReport,
  buildLengthReport,
  buildSelfReport,
  callsPerPair,
  composeJudgeSystem,
  composeJudgeTurn,
  composeWriterSystem,
  estimateJudgeCostFor,
  newJudgeId,
  padShorter,
  type JudgeMode,
  type JudgeRun,
  type Order,
  type Pair,
  type PairResult,
  type PairRow,
  type RunVariant,
  type Writer,
  type Writers,
} from "@/lib/judge";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { PairEditor } from "@/components/play/pair-editor";
import { JudgeReportPanel } from "@/components/play/judge-report";
import { JudgePairCard, type PairCardSection } from "@/components/play/judge-pair-card";
import { WritersPanel } from "@/components/play/writers-panel";
import { SelfPreferenceReportPanel } from "@/components/play/self-preference-report";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { ReflectionCard } from "@/components/play/reflection-card";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";
import { InfoTip } from "@/components/info-tip";

const ORDERS: Order[] = ["ab", "ba"];

type RunKey = { order: Order; variant?: RunVariant; judge?: "a" | "b" };

function sameRun(run: JudgeRun, key: RunKey): boolean {
  return (
    run.order === key.order &&
    (run.variant ?? "plain") === (key.variant ?? "plain") &&
    run.judge === key.judge
  );
}

function tone(verdict: string): PairCardSection["verdictTone"] {
  if (/flipped|moved-to|each-own/i.test(verdict)) return "danger";
  if (/agrees|held|agreed/i.test(verdict)) return "success";
  return "quiet";
}

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
  const [mode, setMode] = useState<JudgeMode>("pairs");
  const [lengthCheck, setLengthCheck] = useState(false);
  const [filler, setFiller] = useState(DEFAULT_FILLER);
  const [showFiller, setShowFiller] = useState(false);
  const [writers, setWriters] = useState<Writers>({
    a: { provider: "webllm", model: PROVIDERS.webllm.defaultModel },
    b: { provider: "webllm", model: PROVIDERS.webllm.defaultModel },
  });
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
    setMode(draft.mode ?? "pairs");
    setLengthCheck(!!draft.lengthCheck);
    setFiller(draft.filler ?? DEFAULT_FILLER);
    if (draft.writers) setWriters(draft.writers);
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
      // Writers default to the keyed provider, and to a second keyed
      // provider for B when there is one — two families tell you more.
      const other = BYOK_PROVIDERS.find((p) => p.id !== nextProvider && !!keys[p.id]);
      setWriters({
        a: { provider: nextProvider, model: nextModel },
        b: other
          ? { provider: other.id, model: other.defaultModel }
          : { provider: nextProvider, model: nextModel },
      });
    },
    [keys],
  );

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: handleResolveProvider,
  });

  const isSelf = mode === "self";
  const keyFor = (p: ProviderId) => !providerNeedsKey(p) || !!keys[p];
  const keyReady = isSelf
    ? keyFor(writers.a.provider) && keyFor(writers.b.provider)
    : keyFor(provider);
  const isWebLLM = isSelf
    ? writers.a.provider === "webllm" || writers.b.provider === "webllm"
    : provider === "webllm";

  const judgeSystem = useMemo(() => composeJudgeSystem(criteria), [criteria]);
  const report = useMemo(
    () => buildJudgeReport(pairs, results),
    [pairs, results],
  );
  const lengthReport = useMemo(
    () => (lengthCheck ? buildLengthReport(pairs, results, filler) : null),
    [lengthCheck, pairs, results, filler],
  );
  const selfReport = useMemo(
    () => buildSelfReport(pairs, results),
    [pairs, results],
  );
  const writerNames = useMemo(
    () => ({
      a: modelName(writers.a.provider, writers.a.model),
      b: modelName(writers.b.provider, writers.b.model),
    }),
    [writers],
  );

  const costEstimate = estimateJudgeCostFor(
    mode,
    lengthCheck,
    { provider, model },
    writers,
    judgeSystem,
    pairs,
  );
  const totalCalls = pairs.length * callsPerPair(mode, lengthCheck);

  const scoredPairs = isSelf ? selfReport.scored : report.scored;
  const showReflection = scoredPairs >= 2 && !running && !reflectionDismissed;

  function updateRun(
    pairId: string,
    key: RunKey,
    updater: (prev: JudgeRun) => JudgeRun,
  ) {
    setResults((prev) =>
      prev.map((r) =>
        r.pairId === pairId
          ? {
              ...r,
              runs: r.runs.map((run) => (sameRun(run, key) ? updater(run) : run)),
            }
          : r,
      ),
    );
  }

  /**
   * One judgement. `text` is the pair as the judge should see it — padded,
   * in the length pass — and `who` is the judge, which in self-preference
   * mode is one of the two writers.
   */
  async function runOne(
    pairId: string,
    text: Pair,
    key: RunKey,
    who: Writer,
    judgeTemperature: number,
  ) {
    const apiKey = keys[who.provider];
    updateRun(pairId, key, (prev) => ({ ...prev, status: "running" }));
    try {
      const stream = runChat({
        provider: who.provider,
        model: who.model,
        system: judgeSystem,
        messages: [{ role: "user", content: composeJudgeTurn(text, key.order) }],
        temperature: judgeTemperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          updateRun(pairId, key, (prev) => ({ ...prev, raw: prev.raw + event.delta }));
        } else if (event.type === "done") {
          const cost = calcCost(
            who.provider,
            who.model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          updateRun(pairId, key, (prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
          }));
          recordUsage({
            provider: who.provider,
            model: who.model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          updateRun(pairId, key, (prev) => ({ ...prev, status: "error", error: event.message }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      updateRun(pairId, key, (prev) => ({ ...prev, status: "error", error: message }));
    }
  }

  /** A writer answers the request. The text streams into the pair as it arrives. */
  async function writeAnswer(pair: Pair, side: "a" | "b"): Promise<string> {
    const who = writers[side];
    const apiKey = keys[who.provider];
    let text = "";
    const publish = () =>
      setPairs((prev) =>
        prev.map((p) => (p.id === pair.id ? { ...p, [side]: text, generated: true } : p)),
      );
    text = "";
    publish();
    const stream = runChat({
      provider: who.provider,
      model: who.model,
      system: composeWriterSystem(),
      messages: [{ role: "user", content: pair.prompt }],
      temperature,
      apiKey,
    });
    for await (const event of stream) {
      if (event.type === "text") {
        text += event.delta;
        publish();
      } else if (event.type === "done") {
        recordUsage({
          provider: who.provider,
          model: who.model,
          inputTokens: event.usage.inputTokens,
          outputTokens: event.usage.outputTokens,
        });
      } else if (event.type === "error") {
        throw new Error(event.message);
      }
    }
    return text;
  }

  /** Hand-written pairs: the plain pass, plus the padded pass when asked. */
  async function runPairsMode() {
    const judge: Writer = { provider, model };
    const keysFor = (pair: Pair): RunKey[] => {
      const plain = ORDERS.map((order) => ({ order, variant: "plain" as const }));
      if (!lengthCheck || !padShorter(pair, filler)) return plain;
      return [...plain, ...ORDERS.map((order) => ({ order, variant: "padded" as const }))];
    };
    setResults(
      pairs.map((p) => ({
        pairId: p.id,
        runs: keysFor(p).map((key) => ({ ...key, raw: "", status: "idle" as const })),
      })),
    );
    const jobs = pairs.flatMap((pair) => keysFor(pair).map((key) => ({ pair, key })));
    await runPool(jobs, isWebLLM ? 1 : BYOK_CONCURRENCY, (job) => {
      const text =
        job.key.variant === "padded"
          ? (padShorter(job.pair, filler)?.pair ?? job.pair)
          : job.pair;
      return runOne(job.pair.id, text, job.key, judge, temperature);
    });
  }

  /** Two writers answer; then each judges the pair both ways. */
  async function runSelfMode() {
    const keysFor = (): RunKey[] =>
      (["a", "b"] as const).flatMap((judge) =>
        ORDERS.map((order) => ({ order, variant: "plain" as const, judge })),
      );
    setResults(
      pairs.map((p) => ({
        pairId: p.id,
        runs: keysFor().map((key) => ({ ...key, raw: "", status: "idle" as const })),
      })),
    );
    const runPair = async (pair: Pair) => {
      let a = "";
      let b = "";
      try {
        [a, b] = await Promise.all([writeAnswer(pair, "a"), writeAnswer(pair, "b")]);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        for (const key of keysFor()) {
          updateRun(pair.id, key, (prev) => ({ ...prev, status: "error", error: `Writing failed: ${message}` }));
        }
        return;
      }
      const written: Pair = { ...pair, a, b, generated: true };
      await runPool(keysFor(), isWebLLM ? 1 : 4, (key) =>
        runOne(pair.id, written, key, writers[key.judge!], SELF_JUDGE_TEMPERATURE),
      );
    };
    await runPool(pairs, isWebLLM ? 1 : 2, runPair);
  }

  async function runAll() {
    if (!keyReady || pairs.length === 0) return;
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    if (isSelf) await runSelfMode();
    else await runPairsMode();
    setRunning(false);
  }

  function switchMode(next: JudgeMode) {
    if (next === mode || running) return;
    setMode(next);
    setResults([]);
    setReflectionDismissed(false);
  }

  /** The card sections for one pair, by mode. */
  function sectionsFor(row: PairRow): PairCardSection[] {
    const runs = results.find((r) => r.pairId === row.pair.id)?.runs ?? [];
    const find = (key: RunKey) => runs.find((r) => sameRun(r, key));
    if (isSelf) {
      const selfRow = selfReport.rows.find((r) => r.pair.id === row.pair.id);
      if (!selfRow) return [];
      return (["a", "b"] as const).map((judge) => {
        const jr = judge === "a" ? selfRow.judgeA : selfRow.judgeB;
        return {
          key: `judge-${judge}`,
          title: `Judged by ${writerNames[judge]} (writer ${judge.toUpperCase()})`,
          verdict: VERDICT_LABEL[jr.verdict],
          verdictTone: tone(jr.verdict),
          ab: find({ order: "ab", judge }),
          ba: find({ order: "ba", judge }),
          pickAB: jr.pickAB,
          pickBA: jr.pickBA,
        };
      });
    }
    const sections: PairCardSection[] = [
      {
        key: "plain",
        title: "As written",
        verdict: VERDICT_LABEL[row.verdict],
        verdictTone: tone(row.verdict),
        ab: find({ order: "ab" }),
        ba: find({ order: "ba" }),
        pickAB: row.pickAB,
        pickBA: row.pickBA,
      },
    ];
    const lengthRow = lengthReport?.rows.find((r) => r.pair.id === row.pair.id);
    if (lengthRow && lengthRow.padded) {
      sections.push({
        key: "padded",
        title: "Shorter answer padded",
        verdict: LENGTH_LABEL[lengthRow.verdict],
        verdictTone: tone(lengthRow.verdict),
        ab: find({ order: "ab", variant: "padded" }),
        ba: find({ order: "ba", variant: "padded" }),
        pickAB: lengthRow.pickAB,
        pickBA: lengthRow.pickBA,
        padded: lengthRow.padded,
      });
    }
    return sections;
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
      mode,
      lengthCheck: isSelf ? undefined : lengthCheck || undefined,
      filler: filler !== DEFAULT_FILLER ? filler : undefined,
      writers: isSelf ? writers : undefined,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !keyReady}
        providerName={
          isSelf
            ? PROVIDERS[keyFor(writers.a.provider) ? writers.b.provider : writers.a.provider].name
            : PROVIDERS[provider].name
        }
        action={isSelf ? "write and judge" : "run the judge"}
      />
      <WebLLMUnsupportedBanner show={isWebLLM} />

      <div className="bg-surface border border-line rounded-[16px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5">
          <ModeButton active={!isSelf} disabled={running} onClick={() => switchMode("pairs")}>
            Hand-written pairs
          </ModeButton>
          <ModeButton active={isSelf} disabled={running} onClick={() => switchMode("self")}>
            Self-preference
          </ModeButton>
        </div>
        <p className="font-mono text-[11px] leading-[1.5] text-ink-quiet max-w-md">
          {isSelf
            ? "Two models each answer the request, then each judges the pair both ways. If each prefers its own, the verdict was about the judge."
            : "One judge, your pairs, judged both ways. Turn on the length check to pad the shorter answer and see whether the verdict follows the length."}
        </p>
      </div>

      {isSelf ? (
        <>
          <ProviderModelTempRow
            provider={provider}
            model={model}
            temperature={temperature}
            onProviderChange={setProvider}
            onModelChange={setModel}
            onTemperatureChange={setTemperature}
          />
          <WritersPanel writers={writers} onChange={setWriters} keyFor={keyFor} disabled={running} />
        </>
      ) : (
        <ProviderModelTempRow
          provider={provider}
          model={model}
          temperature={temperature}
          onProviderChange={setProvider}
          onModelChange={setModel}
          onTemperatureChange={setTemperature}
        />
      )}

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
              writerNames={isSelf ? writerNames : undefined}
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

      {/* Length check */}
      {!isSelf && (
        <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3">
          <label className="inline-flex items-center gap-2 font-mono text-[12px] text-ink cursor-pointer">
            <input
              type="checkbox"
              checked={lengthCheck}
              disabled={running}
              onChange={(e) => setLengthCheck(e.target.checked)}
              className="accent-[var(--highlight)]"
            />
            Also check length — pad the shorter answer and judge again
            <InfoTip>
              The shorter answer is padded with filler that adds nothing until
              it is at least as long as the other, then the pair is judged
              again in both orders. A judge that now prefers the padded answer
              was reading length. Two more calls per pair.
            </InfoTip>
          </label>
          {lengthCheck && (
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => setShowFiller((v) => !v)}
                className="self-start font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                {showFiller ? "Hide" : "Edit"} the filler ·{" "}
                <span className="text-ink-quiet">one sentence per line, cycled</span>
              </button>
              {showFiller && (
                <textarea
                  value={filler}
                  onChange={(e) => setFiller(e.target.value)}
                  rows={3}
                  aria-label="Filler sentences"
                  className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink focus:border-ink focus:outline-none resize-y"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Run controls */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {totalCalls} call{totalCalls === 1 ? "" : "s"} —{" "}
          {isSelf
            ? "two answers, then two judges both ways"
            : lengthCheck
              ? "each pair judged both ways, plain and padded"
              : "each pair judged both ways"}
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
          {running ? (isSelf ? "Writing and judging…" : "Judging…") : isSelf ? "Write, then judge" : "Run the judge"}
        </button>
      </div>

      {isSelf ? (
        <SelfPreferenceReportPanel report={selfReport} names={writerNames} />
      ) : (
        <JudgeReportPanel report={report} length={lengthReport ?? undefined} />
      )}

      <div className="flex flex-col gap-4">
        {report.rows
          .filter((r) => (results.find((x) => x.pairId === r.pair.id)?.runs.length ?? 0) > 0)
          .map((row) => (
            <JudgePairCard key={row.pair.id} label={row.pair.label} sections={sectionsFor(row)} />
          ))}
      </div>

      {showReflection && (
        <ReflectionCard
          reflection={isSelf ? REFLECTION.judgeSelf : REFLECTION.judge}
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
