/**
 * The Round Table session loop against a scripted runChat — no network.
 * Covers turn order, what each seat is shown, the stop rules, failures,
 * Stop, and usage accounting. The playground and the Lab both run this loop.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ChatCall, ChatEvent } from "../lib/providers/types";
import { DEFAULT_PROTOCOL, SEED_SEATS, SEED_TASK, buildRoundtableReport, type Protocol, type Turn } from "../lib/roundtable";
import { runTable } from "../lib/roundtable-run";

async function* stream(text: string, opts: { error?: string; noDone?: boolean } = {}): AsyncIterable<ChatEvent> {
  if (opts.error) {
    yield { type: "error", message: opts.error };
    return;
  }
  for (const word of text.split(" ")) yield { type: "text", delta: word + " " };
  if (!opts.noDone) yield { type: "done", usage: { inputTokens: 100, outputTokens: 40 } };
}

/** The seed's room collapsing: Priya and Sam say FOR; Noor holds AGAINST until round 3, then caves. */
function scriptedTable(opts: { failAt?: number; cutAt?: number; agreeFrom?: number } = {}) {
  const calls: ChatCall[] = [];
  const runChat = (call: ChatCall): AsyncIterable<ChatEvent> => {
    calls.push(call);
    const n = calls.length;
    if (opts.failAt === n) return stream("", { error: "rate limited" });
    if (opts.cutAt === n) return stream("Half a thought", { noDone: true });
    const user = call.messages[0]?.role === "user" ? call.messages[0].content : "";
    const round = Number(/Round (\d+) of/.exec(user)?.[1]);
    const isNoor = call.system.includes("You ran last week's usability test");
    const caves = isNoor && round >= (opts.agreeFrom ?? 3);
    return stream(`Reasoning for round ${round}.\nSTANCE: ${isNoor && !caves ? "AGAINST" : "FOR"}`);
  };
  return { runChat, calls };
}

const deps = (runChat: (c: ChatCall) => AsyncIterable<ChatEvent>) => ({ runChat, keyFor: () => "sk-test" });

test("every seat speaks every round, in seat order, and the table ends on its budget", async () => {
  const { runChat, calls } = scriptedTable();
  const res = await runTable(SEED_SEATS, SEED_TASK, DEFAULT_PROTOCOL, 0.7, deps(runChat));

  assert.equal(calls.length, SEED_SEATS.length * DEFAULT_PROTOCOL.rounds);
  assert.deepEqual(
    res.turns.map((t) => `${t.round}:${t.seatId}`),
    [1, 2, 3].flatMap((r) => SEED_SEATS.map((s) => `${r}:${s.id}`)),
  );
  assert.ok(res.turns.every((t) => t.status === "done"));
  assert.equal(res.stopReason, "budget");
  assert.equal(res.failed, false);
  assert.equal(res.stopped, false);

  // Each call goes to the seat's own model, at the given temperature, with its key.
  assert.ok(calls.every((c, i) => c.model === SEED_SEATS[i % 3].model && c.temperature === 0.7 && c.apiKey === "sk-test"));

  // The report reads the result as it does in the playground: the planted dissenter caved.
  const report = buildRoundtableReport(SEED_SEATS, DEFAULT_PROTOCOL, res.turns, res.stopReason);
  assert.equal(report.consensus, "for");
  assert.equal(report.checks.find((c) => c.id === "planted-held")?.result, "failed");
});

test("each seat reads the table so far; a blind first round shows nobody", async () => {
  const blind: Protocol = { ...DEFAULT_PROTOCOL, firstRound: "blind" };
  const { runChat, calls } = scriptedTable();
  await runTable(SEED_SEATS, SEED_TASK, blind, 0.7, deps(runChat));
  const user = (i: number) => (calls[i].messages[0] as { content: string }).content;

  // Round 1, third seat: blind, so Priya's and Sam's turns aren't in the prompt.
  assert.match(user(2), /Round 1 is blind/);
  assert.doesNotMatch(user(2), /Priya:/);
  // Round 2, first seat: the whole of round 1 is.
  assert.match(user(3), /The table so far/);
  assert.match(user(3), /Noor/);
});

test("the consensus rule stops the table at the first round that agrees", async () => {
  const consensus: Protocol = { ...DEFAULT_PROTOCOL, rounds: 4, stopRule: "consensus" };
  const { runChat, calls } = scriptedTable({ agreeFrom: 2 });
  const res = await runTable(SEED_SEATS, SEED_TASK, consensus, 0.7, deps(runChat));
  assert.equal(res.stopReason, "consensus");
  assert.equal(calls.length, 6);
  assert.deepEqual([...new Set(res.turns.map((t) => t.round))], [1, 2]);
});

test("a failed turn ends the table there, with its error on the turn", async () => {
  const { runChat, calls } = scriptedTable({ failAt: 5 });
  const res = await runTable(SEED_SEATS, SEED_TASK, DEFAULT_PROTOCOL, 0.7, deps(runChat));
  assert.equal(calls.length, 5);
  assert.equal(res.failed, true);
  assert.equal(res.stopReason, null);
  assert.equal(res.turns.at(-1)?.status, "error");
  assert.equal(res.turns.at(-1)?.error, "rate limited");
});

test("a turn whose stream ends without finishing counts as failed, not running", async () => {
  const { runChat } = scriptedTable({ cutAt: 2 });
  const res = await runTable(SEED_SEATS, SEED_TASK, DEFAULT_PROTOCOL, 0.7, deps(runChat));
  assert.equal(res.failed, true);
  assert.equal(res.turns.length, 2);
  assert.equal(res.turns[1].status, "error");
  assert.ok(res.turns.every((t) => t.status !== "running"));
});

test("Stop: no new turn starts once the signal fires", async () => {
  const ctl = new AbortController();
  const { runChat, calls } = scriptedTable();
  const res = await runTable(SEED_SEATS, SEED_TASK, DEFAULT_PROTOCOL, 0.7, {
    ...deps(runChat),
    signal: ctl.signal,
    onTurns: (turns) => {
      if (turns.length === 4 && turns[3].status === "done") ctl.abort();
    },
  });
  assert.equal(calls.length, 4);
  assert.equal(res.stopped, true);
  assert.equal(res.failed, false);
  assert.equal(res.stopReason, null);
  assert.ok(calls.every((c) => c.signal === ctl.signal));
});

test("onTurns streams copies; usage and cost are recorded per turn", async () => {
  const { runChat } = scriptedTable();
  const snapshots: Turn[][] = [];
  const usage: number[] = [];
  const res = await runTable(SEED_SEATS, SEED_TASK, { ...DEFAULT_PROTOCOL, rounds: 1 }, 0.7, {
    ...deps(runChat),
    onTurns: (t) => snapshots.push(t),
    record: (u) => usage.push(u.inputTokens + u.outputTokens),
    costOf: (_p, _m, i, o) => (i + o) / 1000,
  });
  // Text streamed in more than one step, and a snapshot isn't mutated by later events.
  const firstRunning = snapshots.find((s) => s[0]?.status === "running" && s[0].text.length > 0)!;
  assert.ok(firstRunning);
  assert.notEqual(firstRunning[0].text, res.turns[0].text);
  assert.deepEqual(usage, [140, 140, 140]);
  assert.ok(res.turns.every((t) => t.costUsd === 0.14 && t.inputTokens === 100 && t.outputTokens === 40));
});
