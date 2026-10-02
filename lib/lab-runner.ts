import type { ProviderId } from "./providers";
import { getModel } from "./providers";
import type { ChatCall, ChatEvent } from "./providers/types";
import { concurrencyFor, newId, runPool } from "./spread";
import {
  composeClassifier,
  composeRater,
  expandCells,
  parseClassifier,
  parseRating,
  plannedCalls,
  resolveCall,
  scoreLocal,
  usesJudge,
  type Experiment,
  type ExperimentRun,
  type Measure,
} from "./experiment";

/**
 * The lab's run loop, kept out of React so it can be tested against a
 * scripted runChat. The component owns state; this owns order of events:
 * stream the answer, score it locally, then ask each judge measure's model
 * and parse its reply. Every state change goes through `onRun`.
 */

export type RunDeps = {
  runChat: (call: ChatCall) => AsyncIterable<ChatEvent>;
  keyFor: (provider: ProviderId) => string | undefined;
  onRun: (run: ExperimentRun) => void;
  /** Stop: runs not yet started never start; finished runs keep their results. */
  signal?: AbortSignal;
  /** Usage accounting (recordUsage in the app). */
  record?: (u: { provider: ProviderId; model: string; inputTokens: number; outputTokens: number }) => void;
  /** Override the base provider's concurrency (tests). */
  concurrency?: number;
};

/** Judges read; they don't write. A short, cold reply is all that's parsed. */
const JUDGE_MAX_TOKENS = 200;

/** One idle run per cell × repeat, in cell order. */
export function planRuns(e: Experiment): ExperimentRun[] {
  return expandCells(e).flatMap(({ conditionId, itemId }) => {
    const model = resolveCall(e, conditionId, itemId).model;
    return Array.from({ length: e.n }, (_, index) => ({
      id: newId("run"),
      conditionId,
      itemId,
      index,
      status: "idle" as const,
      text: "",
      requestedModel: model,
      scores: {},
    }));
  });
}

async function collect(
  stream: AsyncIterable<ChatEvent>,
  onText?: (text: string) => void,
): Promise<{ text: string; error?: string; inputTokens: number; outputTokens: number }> {
  let text = "";
  let error: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  for await (const event of stream) {
    if (event.type === "text") {
      text += event.delta;
      onText?.(text);
    } else if (event.type === "done") {
      inputTokens = event.usage.inputTokens;
      outputTokens = event.usage.outputTokens;
    } else if (event.type === "error") {
      error = event.message;
    }
  }
  return { text, error, inputTokens, outputTokens };
}

async function judge(
  m: Extract<Measure, { kind: "classify" | "rate" }>,
  text: string,
  deps: RunDeps,
): Promise<{ score: boolean | number | null; raw: string }> {
  const prompt = m.kind === "classify" ? composeClassifier(m, text) : composeRater(m, text);
  const reply = await collect(
    deps.runChat({
      provider: m.judge.provider,
      model: m.judge.model,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.user }],
      // Temperature 0: the judge's variance is not the thing being measured.
      temperature: 0,
      maxTokens: JUDGE_MAX_TOKENS,
      apiKey: deps.keyFor(m.judge.provider),
    }),
  );
  deps.record?.({
    provider: m.judge.provider,
    model: m.judge.model,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
  });
  if (reply.error) return { score: null, raw: `Judge error: ${reply.error}` };
  if (m.kind === "classify") {
    const label = parseClassifier(reply.text, m.labels);
    return { score: label === null ? null : label === m.target, raw: reply.text };
  }
  return { score: parseRating(reply.text, m.scale), raw: reply.text };
}

/**
 * Run every planned run. Runs are passed in (rather than planned here) so
 * the component can show the idle grid before the first token arrives.
 */
export async function runExperiment(e: Experiment, runs: ExperimentRun[], deps: RunDeps): Promise<void> {
  const limit = deps.concurrency ?? concurrencyFor(e.base.model.provider);

  await runPool(runs, limit, async (planned) => {
    if (deps.signal?.aborted) return;
    const call = resolveCall(e, planned.conditionId, planned.itemId);
    const startedAt = Date.now();
    let run: ExperimentRun = { ...planned, status: "running", startedAt, text: "", scores: {} };
    deps.onRun(run);

    const reply = await collect(
      deps.runChat({ ...call, apiKey: deps.keyFor(call.provider) }),
      (text) => {
        run = { ...run, text };
        deps.onRun(run);
      },
    );
    deps.record?.({
      provider: call.provider,
      model: call.model,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
    });

    if (reply.error) {
      deps.onRun({ ...run, status: "error", error: reply.error, latencyMs: Date.now() - startedAt });
      return;
    }

    const scores: ExperimentRun["scores"] = {};
    const judgeRaw: Record<string, string> = {};
    for (const m of e.measures) {
      if (m.kind === "classify" || m.kind === "rate") {
        if (deps.signal?.aborted) {
          scores[m.id] = null;
          continue;
        }
        const j = await judge(m, reply.text, deps);
        scores[m.id] = j.score;
        judgeRaw[m.id] = j.raw;
      } else {
        scores[m.id] = scoreLocal(m, reply.text);
      }
    }

    deps.onRun({
      ...run,
      text: reply.text,
      status: "done",
      latencyMs: Date.now() - startedAt,
      inputTokens: reply.inputTokens,
      outputTokens: reply.outputTokens,
      scores,
      judgeRaw: Object.keys(judgeRaw).length ? judgeRaw : undefined,
    });
  });
}

/** Output tokens assumed per run when estimating; matches Spread's estimate. */
const ASSUMED_OUTPUT_TOKENS = 250;

/**
 * Preflight: how many calls, and roughly what they cost. Prompt tokens are
 * estimated at four characters each, outputs at a fixed allowance — the same
 * rough model Spread uses. Free when every model involved is free (in-browser).
 */
export function estimateExperimentCost(e: Experiment): { calls: number; usd: number; free: boolean } {
  const calls = plannedCalls(e);
  let usd = 0;
  let free = true;
  for (const { conditionId, itemId } of expandCells(e)) {
    const call = resolveCall(e, conditionId, itemId);
    const first = call.messages[0];
    const promptChars = call.system.length + (first && first.role === "user" ? first.content.length : 0);
    const meta = getModel(call.provider, call.model);
    const runOutput = Math.min(ASSUMED_OUTPUT_TOKENS, call.maxTokens);
    if (call.provider !== "webllm") free = false;
    if (meta) {
      usd += e.n * ((promptChars / 4 / 1e6) * meta.inputPer1M + (runOutput / 1e6) * meta.outputPer1M);
    }
    for (const m of e.measures.filter(usesJudge)) {
      if (m.kind !== "classify" && m.kind !== "rate") continue;
      if (m.judge.provider !== "webllm") free = false;
      const jm = getModel(m.judge.provider, m.judge.model);
      if (!jm) continue;
      // The judge reads the answer plus its own instructions (~600 chars).
      const judgeIn = (runOutput * 4 + 600) / 4;
      usd += e.n * ((judgeIn / 1e6) * jm.inputPer1M + (JUDGE_MAX_TOKENS / 1e6) * jm.outputPer1M);
    }
  }
  return { calls, usd: free ? 0 : usd, free };
}
