/**
 * Round Table experiments: one Lab run is a whole table. Covers building one
 * from the playground, each condition's table, call counts and costs, how a
 * finished table becomes scores, a full scripted experiment through the Lab
 * runner and its stats, validation, and the manifest.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type { ChatCall, ChatEvent } from "../lib/providers/types";
import {
  analyze,
  buildManifest,
  isBinary,
  isClear,
  manifestHash,
  plannedCalls,
  validateExperiment,
  type Experiment,
  type ExperimentRun,
} from "../lib/experiment";
import {
  TABLE_CHECKS,
  TABLE_DEFAULT_N,
  fromRoundtable,
  scoreTableCheck,
  tableFor,
  type TableSetup,
} from "../lib/experiment-table";
import { estimateExperimentCost, planRuns, runExperiment } from "../lib/lab-runner";
import {
  DEFAULT_PROTOCOL,
  SEED_SEATS,
  SEED_TASK,
  buildRoundtableReport,
  type Protocol,
  type Seat,
  type Stance,
  type Turn,
} from "../lib/roundtable";

const SETUP: TableSetup = { seats: SEED_SEATS, task: SEED_TASK, protocol: DEFAULT_PROTOCOL, temperature: 0.7 };
const [priya, sam, noor] = SEED_SEATS;

const turn = (round: number, seat: Seat, stance: Stance | null): Turn => ({
  round,
  seatId: seat.id,
  text: `Reasoning.${stance ? `\nSTANCE: ${stance.toUpperCase()}` : ""}`,
  status: "done",
});

/** A finished table from a stance grid: one row per round, seats in seed order. */
function table(grid: (Stance | null)[][], seats = SEED_SEATS): Turn[] {
  return grid.flatMap((row, i) => row.map((s, j) => turn(i + 1, seats[j], s)));
}

test("from the playground: the table is the baseline, the comparison flips the first round", () => {
  const e = fromRoundtable(SETUP, 0);
  assert.equal(validateExperiment(e).ok, true);
  assert.deepEqual(e.items, []);
  assert.equal(e.n, TABLE_DEFAULT_N);
  assert.deepEqual(
    e.conditions.map((c) => [c.label, c.patch]),
    [
      ["Open first round", {}],
      ["Blind first round", { protocol: { firstRound: "blind" } }],
    ],
  );
  // Noor is planted, side-notes are off: planted-held is in, the side-note check isn't.
  assert.deepEqual(
    e.measures.map((m) => (m.kind === "table" ? m.check : m.kind)),
    ["planted-held", "dissent-survived", "not-anchored", "clear-stances"],
  );
  assert.match(e.title, /Noor/);

  const fromBlind = fromRoundtable({ ...SETUP, protocol: { ...DEFAULT_PROTOCOL, firstRound: "blind", whispers: true } }, 0);
  assert.deepEqual(fromBlind.conditions[1].patch, { protocol: { firstRound: "open" } });
  assert.ok(fromBlind.measures.some((m) => m.kind === "table" && m.check === "no-move-after-note"));
});

test("each condition's table: protocol changes apply; a first speaker moves to the front", () => {
  const e = fromRoundtable(SETUP, 0);
  e.conditions.push({ id: "c_noor_first", label: "Noor opens", patch: { firstSpeaker: noor.id, protocol: { rounds: 2 } } });
  assert.equal(tableFor(e, "c_flip").protocol.firstRound, "blind");
  assert.equal(tableFor(e, "c_flip").protocol.rounds, 3);
  const t = tableFor(e, "c_noor_first");
  assert.deepEqual(t.seats.map((s) => s.id), [noor.id, priya.id, sam.id]);
  assert.equal(t.protocol.rounds, 2);
  assert.deepEqual(tableFor(e, "c_base").seats, SEED_SEATS);
});

test("calls and cost count whole tables; hosted seats draw on the free tier", () => {
  const e = fromRoundtable(SETUP, 0);
  // 2 conditions × 10 tables × (3 seats × 3 rounds).
  assert.equal(plannedCalls(e), 180);
  const paid = estimateExperimentCost(e);
  assert.equal(paid.calls, 180);
  assert.equal(paid.free, false);
  assert.equal(paid.hostedCalls, 0);
  assert.ok(paid.usd > 0);

  const hosted = fromRoundtable(
    { ...SETUP, seats: SEED_SEATS.map((s) => ({ ...s, provider: "shape-free" as const, model: "claude-haiku-4-5" })) },
    0,
  );
  const est = estimateExperimentCost(hosted);
  assert.equal(est.free, true);
  assert.equal(est.usd, 0);
  assert.equal(est.hostedCalls, 180);

  // A judge measure adds one call per table.
  hosted.measures.push({
    id: "m_j",
    label: "civil",
    kind: "classify",
    question: "Was the discussion civil?",
    labels: ["yes", "no"],
    target: "yes",
    judge: { provider: "shape-free", model: "claude-haiku-4-5" },
  });
  assert.equal(plannedCalls(hosted), 200);
  assert.equal(estimateExperimentCost(hosted).hostedCalls, 200);
});

test("scoring a table: held/failed are yes/no, a check that doesn't apply is unscored, never a miss", () => {
  const score = (turns: Turn[], protocol: Protocol = DEFAULT_PROTOCOL) => {
    const r = buildRoundtableReport(SEED_SEATS, protocol, turns, "budget");
    return Object.fromEntries(Object.keys(TABLE_CHECKS).map((c) => [c, scoreTableCheck(c as never, r)]));
  };

  // Noor caves in round 3; everyone ends FOR, on Priya's opening.
  const caved = score(
    table([
      ["for", "undecided", "against"],
      ["for", "for", "against"],
      ["for", "for", "for"],
    ]),
  );
  assert.deepEqual(caved, {
    "planted-held": false,
    "dissent-survived": false,
    "not-anchored": false,
    "no-move-after-note": null, // side-notes off
    "clear-stances": true,
    "reached-consensus": true,
    "consensus-round": 3,
    "seats-moved": 2, // Sam (undecided → for) and Noor
  });

  // Noor holds; no consensus, so "anchored on the opener" has nothing to compare.
  const held = score(
    table([
      ["for", "for", "against"],
      ["for", "for", "against"],
      ["for", "for", "against"],
    ]),
  );
  assert.equal(held["planted-held"], true);
  assert.equal(held["dissent-survived"], true);
  assert.equal(held["not-anchored"], null);
  assert.equal(held["reached-consensus"], false);
  assert.equal(held["consensus-round"], null);
  assert.equal(held["seats-moved"], 0);

  // A missing stance line: the room can't be fully read.
  const unclear = score(
    table([
      ["for", "for", "against"],
      ["for", null, "against"],
      ["for", "for", null],
    ]),
  );
  assert.equal(unclear["clear-stances"], false);
  // A seat's final position is its last readable stance, as in the playground's report.
  assert.equal(unclear["seats-moved"], 0);
  // A seat that never gives a readable stance can't be counted as moved or not.
  const silent = score(
    table([
      ["for", null, "against"],
      ["for", null, "against"],
      ["for", null, "against"],
    ]),
  );
  assert.equal(silent["seats-moved"], null);

  // Every check's kind matches the stats it gets.
  const e = fromRoundtable(SETUP, 0);
  for (const m of e.measures) assert.equal(isBinary(m), m.kind === "table" && TABLE_CHECKS[m.check].binary);
  assert.equal(isBinary({ id: "x", label: "x", kind: "table", check: "seats-moved" }), false);
});

/**
 * The seed's room, scripted: Priya and Sam argue FOR. Noor argues AGAINST and
 * caves in round 3 — unless she committed blind in round 1, in which case she
 * holds. Her round-1 turn says which, so the fake stays stateless.
 */
function scriptedRoom(opts: { failNoorInBlind?: boolean } = {}) {
  const calls: ChatCall[] = [];
  const runChat = (call: ChatCall): AsyncIterable<ChatEvent> => {
    calls.push(call);
    const user = call.messages[0]?.role === "user" ? call.messages[0].content : "";
    const round = Number(/Round (\d+) of/.exec(user)?.[1]);
    const isNoor = call.system.includes("You ran last week's usability test");
    let text: string;
    if (!isNoor) text = "We should ship.\nSTANCE: FOR";
    else if (round === 1) {
      const blind = user.includes("Round 1 is blind");
      if (blind && opts.failNoorInBlind) return (async function* () { yield { type: "error" as const, message: "overloaded" }; })();
      text = `${blind ? "I committed blind." : "I heard Priya first."}\nSTANCE: AGAINST`;
    } else {
      const committedBlind = user.includes("I committed blind.");
      text = round >= 3 && !committedBlind ? "Fine, ship it.\nSTANCE: FOR" : "Not until step 2 works.\nSTANCE: AGAINST";
    }
    return (async function* () {
      yield { type: "text" as const, delta: text };
      yield { type: "done" as const, usage: { inputTokens: 100, outputTokens: 30 } };
    })();
  };
  return { runChat, calls };
}

async function run(e: Experiment, runChat: (c: ChatCall) => AsyncIterable<ChatEvent>, extra: { signal?: AbortSignal } = {}) {
  const runs = planRuns(e);
  const latest = new Map<string, ExperimentRun>();
  await runExperiment(e, runs, { runChat, keyFor: () => "sk-test", onRun: (r) => latest.set(r.id, r), concurrency: 4, ...extra });
  return { ...e, runs: runs.map((r) => latest.get(r.id) ?? r) };
}

test("a full experiment: every table runs, is scored from its transcript, and the stats see the difference", async () => {
  const e = { ...fromRoundtable(SETUP, 0), n: 8 };
  e.measures.push({ id: "m_len", label: "length (words)", kind: "length" });
  const planned = planRuns(e);
  assert.equal(planned.length, 16);
  assert.ok(planned.every((r) => r.requestedModel === "claude-sonnet-4-6" && r.itemId === null));

  const { runChat, calls } = scriptedRoom();
  const done = await run(e, runChat);
  assert.equal(calls.length, 16 * 9);
  assert.ok(done.runs.every((r) => r.status === "done" && r.turns?.length === 9 && r.stopReason === "budget"));

  // The run's text is the shared transcript, so text measures read the whole table.
  const r0 = done.runs[0];
  assert.match(r0.text, /Priya/);
  assert.match(r0.text, /Noor/);
  assert.ok(typeof r0.scores.m_len === "number" && r0.scores.m_len > 20);
  assert.equal(r0.inputTokens, 900);
  assert.equal(r0.outputTokens, 270);

  const a = analyze(done);
  const held = (cond: string) => {
    const c = a.cells.find((x) => x.measureId === "m_planted-held" && x.conditionId === cond);
    return c?.kind === "binary" ? c.k : undefined;
  };
  assert.deepEqual([held("c_base"), held("c_flip")], [0, 8]);
  const cmp = a.comparisons.find((c) => c.measureId === "m_planted-held")!;
  assert.equal(isClear(cmp), true);
  assert.ok(cmp.kind === "binary" && cmp.diff.diff === 1);
  // "Not anchored" only counts tables that agreed: the open tables all did, on Priya's opening; the blind ones never agreed.
  const anchored = a.cells.filter((c) => c.measureId === "m_not-anchored");
  assert.deepEqual(anchored.map((c) => [c.conditionId, c.n, c.excluded]), [["c_base", 8, 0], ["c_flip", 0, 8]]);
});

test("a table that fails part-way is an errored run with no scores, excluded from the stats", async () => {
  const e = { ...fromRoundtable(SETUP, 0), n: 3 };
  const { runChat } = scriptedRoom({ failNoorInBlind: true });
  const done = await run(e, runChat);
  const blind = done.runs.filter((r) => r.conditionId === "c_flip");
  assert.ok(blind.every((r) => r.status === "error" && r.error === "overloaded" && Object.keys(r.scores).length === 0));
  assert.ok(blind.every((r) => r.turns?.length === 3));
  const cell = analyze(done).cells.find((c) => c.measureId === "m_planted-held" && c.conditionId === "c_flip")!;
  assert.equal(cell.n, 0);
  assert.equal(cell.excluded, 3);
});

test("Stop: tables not yet started never start; the one cut short is marked stopped", async () => {
  const e = { ...fromRoundtable(SETUP, 0), n: 5 };
  const ctl = new AbortController();
  const { runChat, calls } = scriptedRoom();
  const counting = (c: ChatCall) => {
    if (calls.length === 4) ctl.abort();
    return runChat(c);
  };
  const runs = planRuns(e);
  const latest = new Map<string, ExperimentRun>();
  await runExperiment(e, runs, { runChat: counting, keyFor: () => "k", onRun: (r) => latest.set(r.id, r), concurrency: 1, signal: ctl.signal });
  const states = runs.map((r) => latest.get(r.id)?.status ?? "idle");
  assert.equal(states[0], "error");
  assert.equal(latest.get(runs[0].id)?.error, "Stopped.");
  assert.ok(states.slice(1).every((s) => s === "idle"));
});

test("Round Table experiments refuse to run as a class", async () => {
  const e = fromRoundtable(SETUP, 0);
  await assert.rejects(
    runExperiment(e, planRuns(e), { runChat: scriptedRoom().runChat, keyFor: () => "k", onRun: () => {}, classCode: "KQ7M3P" }),
    /can't run as a class/,
  );
});

test("validation: what a Round Table experiment may and may not contain", () => {
  const ok = fromRoundtable(SETUP, 0);
  const bad = (mutate: (e: Experiment) => void) => {
    const e = structuredClone(ok);
    mutate(e);
    const v = validateExperiment(e);
    return v.ok ? null : v.reason;
  };
  assert.equal(bad(() => {}), null);
  assert.match(bad((e) => (e.conditions[1].patch.system = "Be nicer.")) ?? "", /only the protocol/);
  assert.match(bad((e) => (e.conditions[1].patch.firstSpeaker = "ghost")) ?? "", /isn't at the table/);
  assert.match(bad((e) => (e.conditions[1].patch.protocol = { rounds: 9 })) ?? "", /Rounds must be/);
  assert.match(bad((e) => e.table!.seats.splice(1)) ?? "", /2 to 4 seats/);
  assert.match(bad((e) => (e.items = [{ id: "i", label: "i", vars: {} }])) ?? "", /no items/);
  assert.match(bad((e) => ((e.measures[0] as { check: string }).check = "vibes")) ?? "", /unknown table check/);
  assert.match(
    bad((e) => {
      delete e.table;
    }) ?? "",
    /need a table/,
  );
  // A plain experiment with no table bits is untouched by any of this.
  const plain = structuredClone(ok);
  delete plain.table;
  plain.conditions = [{ id: "c", label: "c", patch: {} }];
  plain.measures = [{ id: "m", label: "len", kind: "length" }];
  assert.equal(validateExperiment(plain).ok, true);
});

test("manifest: seats, decision, and each condition's protocol, order and seat prompts; hashes stably", async () => {
  const e = fromRoundtable(SETUP, 0);
  const meta = { appVersion: "test", ranAt: "2026-11-11T00:00:00.000Z", runner: "byok" as const };
  const m = buildManifest(e, meta);
  assert.deepEqual(m.prompts, []);
  assert.deepEqual(m.models.requested, ["claude-sonnet-4-6"]);
  assert.deepEqual(m.params.temperature, [0.7]);
  assert.ok(m.table);
  assert.equal(m.table!.task.proposal, SEED_TASK.proposal);
  assert.deepEqual(m.table!.conditions.map((c) => c.protocol.firstRound), ["open", "blind"]);
  assert.deepEqual(m.table!.conditions[0].order, ["pm", "eng", "ux"]);
  assert.match(m.table!.conditions[0].systems.ux, /usability test/);
  assert.equal(m.table!.seats.find((s) => s.id === "ux")?.plant, "against");
  assert.equal(await manifestHash(m), await manifestHash(buildManifest(structuredClone(e), meta)));
});
