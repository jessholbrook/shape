import type { ProviderId } from "./providers";
import type { ChatCall, ChatEvent } from "./providers/types";
import {
  composeSeatSystem,
  composeSeatUserTurn,
  stopAfterRound,
  type Protocol,
  type Seat,
  type StopReason,
  type Task,
  type Turn,
} from "./roundtable";

/**
 * One Round Table session, kept out of React so the playground and the Lab
 * run the same loop and it can be tested against a scripted runChat.
 *
 * Sequential by nature: every turn reads the table so far, so nothing fans
 * out. The loop owns a local list of turns as the source of truth and hands
 * a fresh copy to `onTurns` after every change, so a transcript can stream.
 * The first turn that fails ends the table: the next seat would be reading a
 * transcript with a hole in it.
 */

export type TableDeps = {
  runChat: (call: ChatCall) => AsyncIterable<ChatEvent>;
  keyFor: (provider: ProviderId) => string | undefined;
  /** Called with a copy of every turn so far, after each change. */
  onTurns?: (turns: Turn[]) => void;
  /** Usage accounting (recordUsage in the app). */
  record?: (u: { provider: ProviderId; model: string; inputTokens: number; outputTokens: number }) => void;
  /** Dollar cost of one call (calcCost in the app). Without it, turns carry no cost. */
  costOf?: (provider: ProviderId, model: string, inputTokens: number, outputTokens: number) => number;
  /** Stop: a turn not yet started never starts; the table ends as stopped. */
  signal?: AbortSignal;
};

export type TableResult = {
  turns: Turn[];
  /** Why the table ended, when it ran to an end. Null when it failed or was stopped. */
  stopReason: StopReason | null;
  /** A turn errored. Its error is on the turn. */
  failed: boolean;
  /** The signal fired before the table ended. */
  stopped: boolean;
};

export async function runTable(
  seats: Seat[],
  task: Task,
  protocol: Protocol,
  temperature: number,
  deps: TableDeps,
): Promise<TableResult> {
  const local: Turn[] = [];
  const publish = () => deps.onTurns?.(local.map((t) => ({ ...t })));
  let stopReason: StopReason | null = null;

  for (let round = 1; round <= protocol.rounds; round++) {
    for (const seat of seats) {
      if (deps.signal?.aborted) return { turns: local, stopReason: null, failed: false, stopped: true };
      const t: Turn = { round, seatId: seat.id, text: "", status: "running" };
      local.push(t);
      publish();
      try {
        const stream = deps.runChat({
          provider: seat.provider,
          model: seat.model,
          system: composeSeatSystem(seat, seats, protocol),
          messages: [
            {
              role: "user",
              content: composeSeatUserTurn(seat, seats, task, protocol, local.slice(0, -1), round),
            },
          ],
          temperature,
          apiKey: deps.keyFor(seat.provider),
          ...(deps.signal ? { signal: deps.signal } : {}),
        });
        for await (const event of stream) {
          if (event.type === "text") {
            t.text += event.delta;
            publish();
          } else if (event.type === "done") {
            t.status = "done";
            t.inputTokens = event.usage.inputTokens;
            t.outputTokens = event.usage.outputTokens;
            if (deps.costOf) {
              t.costUsd = deps.costOf(seat.provider, seat.model, event.usage.inputTokens, event.usage.outputTokens);
            }
            deps.record?.({
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
        // A stream that ends without "done" or "error" (an abort mid-turn) still counts as a failed turn.
        if (t.status === "running") {
          t.status = "error";
          t.error = deps.signal?.aborted ? "Stopped." : "The answer ended before it finished.";
          publish();
        }
        return { turns: local, stopReason: null, failed: true, stopped: !!deps.signal?.aborted };
      }
    }
    stopReason = stopAfterRound(protocol, seats, local, round);
    if (stopReason) break;
  }
  return { turns: local, stopReason, failed: false, stopped: false };
}
