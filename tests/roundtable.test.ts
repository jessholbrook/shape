import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROTOCOL,
  SEED_SEATS,
  SEED_TASK,
  buildRoundtableReport,
  callsFor,
  capsFor,
  composeSeatSystem,
  composeSeatUserTurn,
  parseStance,
  roundConsensus,
  roundtableSummary,
  stopAfterRound,
  stripStance,
  type Protocol,
  type Seat,
  type Stance,
  type Turn,
} from "../lib/roundtable";

const [priya, sam, noor] = SEED_SEATS;
const turn = (round: number, seat: Seat, stance: Stance | null, body = "Some reasoning."): Turn => ({
  round,
  seatId: seat.id,
  text: stance ? `${body}\nSTANCE: ${stance.toUpperCase()}` : body,
  status: "done",
});

describe("roundtable prompts", () => {
  test("a seat's system prompt carries its own role, the others' names only, and the stance format", () => {
    const system = composeSeatSystem(noor, SEED_SEATS);
    assert.match(system, /^You are Noor\. You ran last week's usability test/);
    assert.match(system, /The others at the table: Priya, Sam\./);
    assert.doesNotMatch(system, /product manager|engineer who built/);
    assert.match(system, /STANCE: FOR\nSTANCE: AGAINST\nSTANCE: UNDECIDED/);
    assert.match(system, /under 120 words/);
  });

  test("the user turn shows the table so far with speaker labels, and a blind first round shows nobody", () => {
    const turns = [turn(1, priya, "for", "Ship it."), turn(1, sam, "undecided", "Either way.")];
    const open = composeSeatUserTurn(noor, SEED_SEATS, SEED_TASK, DEFAULT_PROTOCOL, turns, 1);
    assert.match(open, /The proposal: Ship the redesigned onboarding flow/);
    assert.match(open, /\[Round 1\]\nPriya: Ship it\.\nSTANCE: FOR\nSam: Either way\./);
    assert.match(open, /It's your turn, Noor\. Round 1 of 3\./);

    const blindProtocol: Protocol = { ...DEFAULT_PROTOCOL, firstRound: "blind" };
    const blind = composeSeatUserTurn(noor, SEED_SEATS, SEED_TASK, blindProtocol, turns, 1);
    assert.doesNotMatch(blind, /Priya: Ship it/);
    assert.match(blind, /Round 1 is blind/);
    // From round two the blind positions are on the table.
    const second = composeSeatUserTurn(noor, SEED_SEATS, SEED_TASK, blindProtocol, turns, 2);
    assert.match(second, /Priya: Ship it\./);
    assert.match(second, /Round 2 of 3/);

    const empty = composeSeatUserTurn(priya, SEED_SEATS, SEED_TASK, DEFAULT_PROTOCOL, [], 1);
    assert.match(empty, /Nobody has spoken yet\./);
  });
});

describe("roundtable stances", () => {
  test("the last STANCE line wins, case-insensitively, and display strips it", () => {
    assert.equal(parseStance("I lean for.\nSTANCE: FOR"), "for");
    assert.equal(parseStance("stance: against\n…on reflection\nSTANCE: UNDECIDED"), "undecided");
    assert.equal(parseStance("I think we should ship."), null);
    assert.equal(stripStance("Ship it.\nSTANCE: FOR\n"), "Ship it.");
    assert.equal(stripStance("No stance here."), "No stance here.");
  });

  test("a round is consensus only when every seat gave the same for/against", () => {
    const agreed = [turn(1, priya, "for"), turn(1, sam, "for"), turn(1, noor, "for")];
    assert.equal(roundConsensus(agreed, SEED_SEATS, 1), "for");
    const split = [turn(1, priya, "for"), turn(1, sam, "for"), turn(1, noor, "against")];
    assert.equal(roundConsensus(split, SEED_SEATS, 1), null);
    const undecided = [turn(1, priya, "for"), turn(1, sam, "undecided"), turn(1, noor, "for")];
    assert.equal(roundConsensus(undecided, SEED_SEATS, 1), null);
    const missing = [turn(1, priya, "for"), turn(1, sam, "for")];
    assert.equal(roundConsensus(missing, SEED_SEATS, 1), null);
  });

  test("the budget always stops the table; the consensus rule stops it early", () => {
    const agreed = [turn(1, priya, "for"), turn(1, sam, "for"), turn(1, noor, "for")];
    assert.equal(stopAfterRound(DEFAULT_PROTOCOL, SEED_SEATS, agreed, 1), null);
    assert.equal(stopAfterRound(DEFAULT_PROTOCOL, SEED_SEATS, agreed, 3), "budget");
    const early: Protocol = { ...DEFAULT_PROTOCOL, stopRule: "consensus" };
    assert.equal(stopAfterRound(early, SEED_SEATS, agreed, 1), "consensus");
    const split = [turn(1, priya, "for"), turn(1, sam, "for"), turn(1, noor, "against")];
    assert.equal(stopAfterRound(early, SEED_SEATS, split, 1), null);
  });

  test("calls are seats × rounds, and an in-browser seat caps both", () => {
    assert.equal(callsFor(SEED_SEATS, DEFAULT_PROTOCOL), 9);
    assert.deepEqual(capsFor(SEED_SEATS), { maxSeats: 4, maxRounds: 4 });
    const local: Seat[] = [{ ...priya, provider: "webllm", model: "Llama-3.2-1B-Instruct-q4f16_1-MLC" }, sam, noor];
    assert.deepEqual(capsFor(local), { maxSeats: 3, maxRounds: 2 });
  });
});

describe("roundtable report", () => {
  const collapse: Turn[] = [
    turn(1, priya, "for"), turn(1, sam, "undecided"), turn(1, noor, "against"),
    turn(2, priya, "for"), turn(2, sam, "for"), turn(2, noor, "against"),
    turn(3, priya, "for"), turn(3, sam, "for"), turn(3, noor, "for"),
  ];

  test("the seed's collapse: the planted seat gave way, the table settled on the opener's position", () => {
    const report = buildRoundtableReport(SEED_SEATS, DEFAULT_PROTOCOL, collapse, "budget");
    assert.equal(report.complete, true);
    assert.equal(report.roundsRun, 3);
    assert.equal(report.consensus, "for");
    assert.equal(report.consensusRound, 3);
    assert.equal(report.openingStance, "for");
    const noorRow = report.rows[2];
    assert.deepEqual(noorRow.trajectory, ["against", "against", "for"]);
    assert.equal(noorRow.movedAt, 3);
    assert.equal(noorRow.held, false);
    assert.equal(
      report.headline,
      "Noor was planted to hold against and gave way in round 3. The table settled on Priya's opening position.",
    );
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.result]));
    assert.deepEqual(byId, {
      "planted-held": "failed",
      "dissent-survived": "failed",
      "not-anchored": "failed",
      "clear-stances": "held",
    });
    assert.equal(roundtableSummary(SEED_SEATS, report), "Priya, Sam, Noor · 3 rounds · Noor gave way in round 3");
  });

  test("the planted seat holds: no collapse, dissent survived", () => {
    const held = collapse.map((t) => (t.seatId === "ux" ? turn(t.round, noor, "against") : t));
    const report = buildRoundtableReport(SEED_SEATS, DEFAULT_PROTOCOL, held, "budget");
    assert.equal(report.consensus, null);
    assert.equal(report.rows[2].held, true);
    assert.equal(report.rows[2].movedAt, null);
    assert.equal(report.headline, "Noor still holds against after 3 rounds — the table did not collapse.");
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.result]));
    assert.equal(byId["planted-held"], "held");
    assert.equal(byId["dissent-survived"], "held");
    assert.equal(byId["not-anchored"], "na");
    assert.deepEqual(report.tally, { for: 2, against: 1, undecided: 0, unparsed: 0 });
    assert.equal(roundtableSummary(SEED_SEATS, report), "Priya, Sam, Noor · 3 rounds · Noor held");
  });

  test("a planted seat that opens off its plant never held it — a different verb from giving way", () => {
    const turns = [turn(1, noor, "for"), turn(1, priya, "for"), turn(1, sam, "for")];
    const seats = [noor, priya, sam];
    const report = buildRoundtableReport(seats, { ...DEFAULT_PROTOCOL, rounds: 1 }, turns, "consensus");
    assert.equal(
      report.headline,
      "Noor was planted to hold against and never held it — opened for. The table settled on Noor's opening position.",
    );
    assert.equal(roundtableSummary(seats, report), "Noor, Priya, Sam · 1 round · Noor never held");
  });

  test("a missing stance line is named, not guessed", () => {
    const turns = [turn(1, priya, "for"), turn(1, sam, null, "I suppose so."), turn(1, noor, "against")];
    const report = buildRoundtableReport(SEED_SEATS, { ...DEFAULT_PROTOCOL, rounds: 1 }, turns, "budget");
    assert.match(report.headline, /^No clear stance from Sam/);
    assert.equal(report.tally.unparsed, 1);
    assert.equal(report.checks.find((c) => c.id === "clear-stances")!.result, "failed");
  });

  test("an errored turn leaves the run incomplete", () => {
    const turns: Turn[] = [turn(1, priya, "for"), { round: 1, seatId: "eng", text: "", status: "error", error: "429" }];
    const report = buildRoundtableReport(SEED_SEATS, DEFAULT_PROTOCOL, turns);
    assert.equal(report.complete, false);
    assert.match(report.headline, /didn't finish/);
  });

  test("without a planted seat the headline reads the consensus and who opened", () => {
    const seats = SEED_SEATS.map((s) => ({ ...s, plant: undefined }));
    const quick = [turn(1, priya, "for"), turn(1, sam, "for"), turn(1, noor, "for")];
    const r1 = buildRoundtableReport(seats, { ...DEFAULT_PROTOCOL, rounds: 1 }, quick, "budget");
    assert.equal(r1.headline, "Consensus in round 1 — nobody disagreed with anyone.");
    const later = [
      turn(1, priya, "against"), turn(1, sam, "for"), turn(1, noor, "for"),
      turn(2, priya, "for"), turn(2, sam, "for"), turn(2, noor, "for"),
    ];
    const r2 = buildRoundtableReport(seats, { ...DEFAULT_PROTOCOL, rounds: 2 }, later, "budget");
    assert.equal(r2.headline, "Consensus in round 2, against the first speaker's opening.");
    assert.equal(r2.checks.find((c) => c.id === "not-anchored")!.result, "held");
    const empty = buildRoundtableReport(seats, DEFAULT_PROTOCOL, []);
    assert.match(empty.headline, /Run the table/);
  });
});
