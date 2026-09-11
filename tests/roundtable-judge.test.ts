import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { SEED_SEATS, SEED_TASK, type Seat, type Stance, type Turn } from "../lib/roundtable";
import {
  JUDGE_SYSTEM,
  buildReadingReport,
  composeReadingTurn,
  movesOf,
  parseReadingPosition,
  positionToReading,
  readMove,
  readingCalls,
  readingSummary,
  type ReadingRun,
} from "../lib/roundtable-judge";

const [priya, sam, noor] = SEED_SEATS;
const turn = (round: number, seat: Seat, stance: Stance | null, body = "Some reasoning."): Turn => ({
  round,
  seatId: seat.id,
  text: stance ? `${body}\nSTANCE: ${stance.toUpperCase()}` : body,
  status: "done",
});
/** The seed's collapse: Sam settles in round 2, Noor gives way in round 3. */
const collapse: Turn[] = [
  turn(1, priya, "for", "Ship it."), turn(1, sam, "undecided", "Either way."), turn(1, noor, "against", "Three of five failed."),
  turn(2, priya, "for"), turn(2, sam, "for", "Priya's right about the demo."), turn(2, noor, "against"),
  turn(3, priya, "for"), turn(3, sam, "for"), turn(3, noor, "for", "If everyone's comfortable, fine."),
];
const reading = (seat: Seat, round: number, order: "pc" | "cp", slot: 1 | 2 | null, extra: Partial<ReadingRun> = {}): ReadingRun => ({
  seatId: seat.id,
  round,
  order,
  raw: slot ? `Because of the demo.\nREADING: ${slot}` : "Hard to say.",
  status: "done",
  ...extra,
});

describe("roundtable judge — moves", () => {
  test("a move is a readable stance that differs from the seat's previous one; round one never is", () => {
    const moves = movesOf(SEED_SEATS, collapse);
    assert.deepEqual(
      moves.map((m) => [m.seatId, m.round, m.from, m.to, m.turnIndex]),
      [["eng", 2, "undecided", "for", 4], ["ux", 3, "against", "for", 8]],
    );
    // A turn without a stance line neither moves nor resets the comparison.
    const gap = [turn(1, noor, "against"), turn(2, noor, null), turn(3, noor, "for")];
    assert.deepEqual(movesOf([noor], gap).map((m) => [m.round, m.from, m.to]), [[3, "against", "for"]]);
    assert.deepEqual(movesOf([noor], [turn(1, noor, "against"), turn(2, noor, "against")]), []);
    assert.equal(readingCalls(2), 4);
  });

  test("the judge sees the table only up to the move, and the options in the order asked", () => {
    const [samMove, noorMove] = movesOf(SEED_SEATS, collapse);
    const pc = composeReadingTurn(noorMove, SEED_SEATS, SEED_TASK, collapse, "pc");
    assert.match(pc, /The proposal: Ship the redesigned onboarding flow/);
    assert.match(pc, /\[Round 3\]\nPriya: Some reasoning\.\nSTANCE: FOR\nSam: Some reasoning\.\nSTANCE: FOR\nNoor: If everyone's comfortable, fine\.\nSTANCE: FOR/);
    assert.match(pc, /The turn in question: Noor, round 3 — position moved from against to for\./);
    assert.match(pc, /Option 1 — Persuaded: The turn points to a specific argument/);
    assert.match(pc, /Option 2 — Conforming: The turn defers to agreement/);
    const cp = composeReadingTurn(noorMove, SEED_SEATS, SEED_TASK, collapse, "cp");
    assert.match(cp, /Option 1 — Conforming/);
    assert.match(cp, /Option 2 — Persuaded/);
    // Sam's move in round 2: nothing from round 3 is in view, and Noor's round-2 turn (later in order) isn't either.
    const samTurn = composeReadingTurn(samMove, SEED_SEATS, SEED_TASK, collapse, "pc");
    assert.doesNotMatch(samTurn, /\[Round 3\]/);
    assert.match(samTurn, /\[Round 2\]\nPriya: Some reasoning\.\nSTANCE: FOR\nSam: Priya's right about the demo\.\nSTANCE: FOR\n\nThe turn in question/);
    assert.match(JUDGE_SYSTEM, /READING: 1\nREADING: 2/);
  });

  test("the judge sees the private notes the mover had received, and nobody else's", () => {
    const whispered: Turn[] = collapse.map((t, i) =>
      i === 3 ? { ...t, text: `${t.text}\nWHISPER to Noor: everyone else is on board — don't be the holdout.` } : t,
    );
    const [samMove, noorMove] = movesOf(SEED_SEATS, whispered);
    const noorTurn = composeReadingTurn(noorMove, SEED_SEATS, SEED_TASK, whispered, "pc");
    assert.match(noorTurn, /Private notes Noor had received \(the rest of the table could not see these\):\n\[Round 2\] Priya: everyone else is on board/);
    assert.doesNotMatch(noorTurn, /WHISPER/);
    const samTurn = composeReadingTurn(samMove, SEED_SEATS, SEED_TASK, whispered, "pc");
    assert.doesNotMatch(samTurn, /Private notes|don't be the holdout/);
  });
});

describe("roundtable judge — readings", () => {
  test("the last READING line wins and maps back through the order", () => {
    assert.equal(parseReadingPosition("Leaning 1… on reflection READING: 2"), 2);
    assert.equal(parseReadingPosition("reading: one"), 1);
    assert.equal(parseReadingPosition("No line here."), null);
    assert.equal(positionToReading(1, "pc"), "persuaded");
    assert.equal(positionToReading(1, "cp"), "conforming");
    assert.equal(positionToReading(2, "cp"), "persuaded");
    assert.equal(positionToReading(null, "pc"), null);
  });

  test("a reading holds only when both orders agree; the same slot both ways is position", () => {
    const [, noorMove] = movesOf(SEED_SEATS, collapse);
    const conforming = readMove(noorMove, [reading(noor, 3, "pc", 2), reading(noor, 3, "cp", 1)]);
    assert.equal(conforming.verdict, "conforming");
    assert.deepEqual(conforming.readings, { pc: "conforming", cp: "conforming" });
    const persuaded = readMove(noorMove, [reading(noor, 3, "pc", 1), reading(noor, 3, "cp", 2)]);
    assert.equal(persuaded.verdict, "persuaded");
    const position = readMove(noorMove, [reading(noor, 3, "pc", 1), reading(noor, 3, "cp", 1)]);
    assert.equal(position.verdict, "position");
    const unparsed = readMove(noorMove, [reading(noor, 3, "pc", 2), reading(noor, 3, "cp", null)]);
    assert.equal(unparsed.verdict, "unparsed");
    const incomplete = readMove(noorMove, [reading(noor, 3, "pc", 2), reading(noor, 3, "cp", 1, { status: "running" })]);
    assert.equal(incomplete.verdict, "incomplete");
    assert.equal(readMove(noorMove, []).verdict, "incomplete");
    // Runs for another move are ignored.
    const other = readMove(noorMove, [reading(sam, 2, "pc", 1), reading(sam, 2, "cp", 2)]);
    assert.equal(other.verdict, "incomplete");
  });

  test("the report counts moves by verdict and summarises them", () => {
    const runs = [
      reading(sam, 2, "pc", 1), reading(sam, 2, "cp", 2),   // persuaded
      reading(noor, 3, "pc", 2), reading(noor, 3, "cp", 1), // conforming
    ];
    const report = buildReadingReport(SEED_SEATS, collapse, runs);
    assert.equal(report.moves, 2);
    assert.equal(report.read, 2);
    assert.equal(report.persuaded, 1);
    assert.equal(report.conforming, 1);
    assert.equal(report.position, 0);
    assert.equal(readingSummary(report), "1 conforming, 1 persuaded");
    const biased = buildReadingReport(SEED_SEATS, collapse, [
      reading(sam, 2, "pc", 1), reading(sam, 2, "cp", 1),
      reading(noor, 3, "pc", 1), reading(noor, 3, "cp", 1),
    ]);
    assert.equal(biased.position, 2);
    assert.equal(readingSummary(biased), "2 unreadable");
    assert.equal(readingSummary(buildReadingReport(SEED_SEATS, collapse, [])), "not judged");
    assert.equal(readingSummary(buildReadingReport(SEED_SEATS, collapse.slice(0, 3), [])), "no moves to read");
  });
});
