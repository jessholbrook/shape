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
  DEFAULT_PROTOCOL,
  DEFAULT_TEMPERATURE,
  SEED_SEATS,
  SEED_TASK,
  buildRoundtableReport,
  callsFor,
  capsFor,
  composeSeatSystem,
  composeSeatUserTurn,
  estimateRoundtableCost,
  stopAfterRound,
  type Protocol,
  type Seat,
  type StopReason,
  type Task,
  type Turn,
} from "@/lib/roundtable";
import { suggestTitle, type ProtocolDraft } from "@/lib/drafts";
import type { Writer } from "@/lib/judge";
import {
  JUDGE_SYSTEM,
  JUDGE_TEMPERATURE,
  READING_ORDERS,
  buildReadingReport,
  composeReadingTurn,
  estimateReadingCost,
  movesOf,
  readingCalls,
  type ReadingRun,
} from "@/lib/roundtable-judge";
import { REFLECTION } from "@/lib/reflection-questions";
import { InfoTip } from "@/components/info-tip";
import { SeatPanel } from "@/components/play/seat-panel";
import { ProtocolPanel } from "@/components/play/protocol-panel";
import { RoundtableTranscript } from "@/components/play/roundtable-transcript";
import { RoundtableReportPanel } from "@/components/play/roundtable-report";
import { ReadingPanel } from "@/components/play/reading-panel";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ReflectionCard } from "@/components/play/reflection-card";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";

export function RoundtableWorkshop() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [seats, setSeats] = useState<Seat[]>(SEED_SEATS);
  const [task, setTask] = useState<Task>(SEED_TASK);
  const [protocol, setProtocol] = useState<Protocol>(DEFAULT_PROTOCOL);
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stopReason, setStopReason] = useState<StopReason | null>(null);
  const [judge, setJudge] = useState<Writer>({ provider: "anthropic", model: PROVIDERS.anthropic.defaultModel });
  const [readings, setReadings] = useState<ReadingRun[]>([]);
  const [judging, setJudging] = useState(false);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);
  const [reflectionNote, setReflectionNote] = useState("");

  useUnsavedWork(dirty);

  const hydrateFromDraft = useCallback((draft: ProtocolDraft) => {
    setSeats(draft.seats);
    setTask(draft.task);
    setProtocol(draft.protocol);
    setTemperature(draft.temperature);
    setTurns(draft.turns);
    setStopReason(draft.stopReason ?? null);
    if (draft.judge) {
      setJudge(draft.judge.judge);
      setReadings(draft.judge.runs);
    } else {
      setReadings([]);
    }
    setReflectionNote(draft.reflection ?? "");
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/roundtable",
    kind: "protocol",
    apply: hydrateFromDraft,
  });

  // Every seat follows the default provider until something has been said.
  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: useCallback((p: ProviderId, m: string) => {
      setSeats((prev) => prev.map((s) => ({ ...s, provider: p, model: m })));
      setJudge({ provider: p, model: m });
    }, []),
  });

  const keyFor = useCallback(
    (provider: ProviderId) => hydrated && (!providerNeedsKey(provider) || !!keys[provider]),
    [hydrated, keys],
  );
  const missing = seats.find((s) => !keyFor(s.provider));
  const ready = hydrated && !missing && seats.every((s) => s.name.trim());
  const caps = capsFor(seats);
  const usesLocal = seats.some((s) => s.provider === "webllm");

  // An in-browser seat caps the rounds; the cap is applied where the protocol
  // is read rather than written back, so seating a local model never edits
  // the setting and unseating it restores the rounds.
  const live = useMemo<Protocol>(
    () => ({ ...protocol, rounds: Math.min(protocol.rounds, caps.maxRounds) }),
    [protocol, caps.maxRounds],
  );

  const report = useMemo(
    () => buildRoundtableReport(seats, live, turns, stopReason),
    [seats, live, turns, stopReason],
  );
  const calls = callsFor(seats, live);
  const costUsd = useMemo(
    () => estimateRoundtableCost(seats, live, task),
    [seats, live, task],
  );
  const showReflection = report.complete && !running && !reflectionDismissed;

  const moves = useMemo(() => movesOf(seats, turns), [seats, turns]);
  const readingReport = useMemo(
    () => buildReadingReport(seats, turns, readings),
    [seats, turns, readings],
  );
  const readingCost = useMemo(
    () => estimateReadingCost(judge, moves, seats, task, turns),
    [judge, moves, seats, task, turns],
  );
  const judgeHasKey = keyFor(judge.provider);

  function resetRun() {
    setTurns([]);
    setStopReason(null);
    setReadings([]);
    setReflectionDismissed(false);
  }

  /**
   * Every move read twice, once per option order. The calls are independent
   * — each carries the table only up to its move — so they fan out, except
   * on the in-browser engine, which takes one call at a time.
   */
  async function judgeMoves() {
    if (!judgeHasKey || judging || moves.length === 0) return;
    setJudging(true);
    setDirty(true);
    const apiKey = keys[judge.provider];
    const local: ReadingRun[] = moves.flatMap((m) =>
      READING_ORDERS.map((order) => ({
        seatId: m.seatId,
        round: m.round,
        order,
        raw: "",
        status: "running" as const,
      })),
    );
    const publish = () => setReadings(local.map((r) => ({ ...r })));
    publish();
    const jobs = local.map((r) => async () => {
      const move = moves.find((m) => m.seatId === r.seatId && m.round === r.round)!;
      try {
        const stream = runChat({
          provider: judge.provider,
          model: judge.model,
          system: JUDGE_SYSTEM,
          messages: [{ role: "user", content: composeReadingTurn(move, seats, task, turns, r.order) }],
          temperature: JUDGE_TEMPERATURE,
          apiKey,
        });
        for await (const event of stream) {
          if (event.type === "text") {
            r.raw += event.delta;
            publish();
          } else if (event.type === "done") {
            r.status = "done";
            r.inputTokens = event.usage.inputTokens;
            r.outputTokens = event.usage.outputTokens;
            r.costUsd = calcCost(judge.provider, judge.model, event.usage.inputTokens, event.usage.outputTokens);
            recordUsage({
              provider: judge.provider,
              model: judge.model,
              inputTokens: event.usage.inputTokens,
              outputTokens: event.usage.outputTokens,
            });
            publish();
          } else if (event.type === "error") {
            r.status = "error";
            r.error = event.message;
            publish();
          }
        }
      } catch (err) {
        r.status = "error";
        r.error = err instanceof Error ? err.message : String(err);
        publish();
      }
    });
    if (judge.provider === "webllm") {
      for (const job of jobs) await job();
    } else {
      await Promise.all(jobs.map((job) => job()));
    }
    setJudging(false);
  }

  /**
   * Sequential by nature: every turn reads the table so far, so nothing can
   * fan out. A local copy of the turns is the source of truth while the run
   * is going; state mirrors it after every change so the transcript streams.
   */
  async function runTable() {
    if (!ready || running) return;
    setRunning(true);
    setDirty(true);
    setReflectionDismissed(false);
    setStopReason(null);
    setReadings([]);
    const local: Turn[] = [];
    const publish = () => setTurns([...local]);
    let reason: StopReason | null = null;
    let failed = false;

    outer: for (let round = 1; round <= live.rounds; round++) {
      for (const seat of seats) {
        const t: Turn = { round, seatId: seat.id, text: "", status: "running" };
        local.push(t);
        publish();
        const apiKey = keys[seat.provider];
        try {
          const stream = runChat({
            provider: seat.provider,
            model: seat.model,
            system: composeSeatSystem(seat, seats),
            messages: [
              {
                role: "user",
                content: composeSeatUserTurn(seat, seats, task, live, local.slice(0, -1), round),
              },
            ],
            temperature,
            apiKey,
          });
          for await (const event of stream) {
            if (event.type === "text") {
              t.text += event.delta;
              publish();
            } else if (event.type === "done") {
              t.status = "done";
              t.inputTokens = event.usage.inputTokens;
              t.outputTokens = event.usage.outputTokens;
              t.costUsd = calcCost(seat.provider, seat.model, event.usage.inputTokens, event.usage.outputTokens);
              recordUsage({
                provider: seat.provider,
                model: seat.model,
                inputTokens: event.usage.inputTokens,
                outputTokens: event.usage.outputTokens,
              });
              publish();
            } else if (event.type === "error") {
              t.status = "error";
              t.error = event.message;
              publish();
            }
          }
        } catch (err) {
          t.status = "error";
          t.error = err instanceof Error ? err.message : String(err);
          publish();
        }
        if (t.status !== "done") {
          failed = true;
          break outer;
        }
      }
      reason = stopAfterRound(live, seats, local, round);
      if (reason) break;
    }
    if (!failed) setStopReason(reason);
    setRunning(false);
  }

  function handleSaveDraft() {
    const lead = seats[0];
    save({
      title: title.trim() || suggestTitle(task.proposal, "Untitled roundtable"),
      provider: lead?.provider ?? "anthropic",
      model: lead?.model ?? PROVIDERS.anthropic.defaultModel,
      temperature,
      seats,
      task,
      protocol: live,
      turns,
      stopReason: stopReason ?? undefined,
      judge: readings.length > 0 ? { judge, runs: readings } : undefined,
      reflection: reflectionNote.trim() || undefined,
    });
    setDirty(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !!missing}
        providerName={missing ? PROVIDERS[missing.provider].name : ""}
        action="seat that model at the table"
      />
      <WebLLMUnsupportedBanner show={usesLocal} />

      <SeatPanel
        seats={seats}
        onChange={(next) => {
          setSeats(next);
          setDirty(true);
        }}
        keyFor={keyFor}
        maxSeats={caps.maxSeats}
        disabled={running}
      />

      {/* The decision */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
          The decision
          <InfoTip>
            One proposal the table has to take a position on, phrased so that
            FOR and AGAINST mean something, and the background everyone at the
            table knows. Each seat&apos;s role is what only that seat knows.
          </InfoTip>
        </span>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">Proposal</span>
          <textarea
            value={task.proposal}
            disabled={running}
            onChange={(e) => {
              setTask({ ...task, proposal: e.target.value });
              setDirty(true);
            }}
            rows={2}
            aria-label="Proposal"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink focus:border-ink focus:outline-none resize-y disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">Background</span>
          <textarea
            value={task.brief}
            disabled={running}
            onChange={(e) => {
              setTask({ ...task, brief: e.target.value });
              setDirty(true);
            }}
            rows={4}
            aria-label="Background"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[13px] leading-[1.55] text-ink focus:border-ink focus:outline-none resize-y disabled:opacity-60"
          />
        </label>
      </div>

      <ProtocolPanel
        protocol={live}
        onChange={(next) => {
          setProtocol(next);
          setDirty(true);
        }}
        temperature={temperature}
        onTemperatureChange={(t) => {
          setTemperature(t);
          setDirty(true);
        }}
        maxRounds={caps.maxRounds}
        calls={calls}
        costUsd={costUsd}
        disabled={running}
      />

      {/* Run row */}
      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runTable}
            disabled={!ready || running}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running
              ? `Round ${turns.length ? turns[turns.length - 1].round : 1} of ${live.rounds}…`
              : turns.length > 0
                ? "Run the table again"
                : "Run the table"}
            <span className="text-highlight">→</span>
          </button>
          <button
            type="button"
            onClick={resetRun}
            disabled={running || turns.length === 0}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Reset
          </button>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {running
            ? `${turns.filter((t) => t.status === "done").length} of ${calls} turns spoken`
            : turns.length > 0
              ? `${turns.length} turns · ${report.roundsRun} ${report.roundsRun === 1 ? "round" : "rounds"}${
                  stopReason === "consensus" ? " · stopped at consensus" : ""
                }`
              : `${seats.length} seats × ${live.rounds} rounds — nothing is decided until you run it`}
        </span>
      </div>

      {turns.length > 0 && <RoundtableReportPanel report={report} readings={readingReport} />}
      {report.complete && !running && (
        <ReadingPanel
          seats={seats}
          report={readingReport}
          judge={judge}
          onJudgeChange={(next) => {
            setJudge(next);
            setDirty(true);
          }}
          hasKey={judgeHasKey}
          calls={readingCalls(moves.length)}
          costUsd={readingCost}
          judging={judging}
          disabled={running}
          onJudge={judgeMoves}
        />
      )}
      <RoundtableTranscript turns={turns} seats={seats} />

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.roundtable}
          answer={reflectionNote}
          onAnswerChange={(v) => {
            setReflectionNote(v);
            setDirty(true);
          }}
          onDismiss={() => setReflectionDismissed(true)}
        />
      )}

      <DraftSaveBar
        artifact="Protocol"
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}
