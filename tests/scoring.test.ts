/**
 * Unit tests for the scoring layer.
 *
 * Every playground ends in a verdict — held/failed, grounded/injected,
 * agrees/flipped, correct/over-acted — and those verdicts are the product.
 * A wrong one is worse than a crash: it reads as a finding and teaches the
 * opposite of the lesson. This file covers the cases where the label and the
 * evidence can come apart.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  attribute,
  buildContextReport,
  echoed,
  SEED_SETS,
  SEED_SOURCES,
  type SetRun,
  type Source,
} from "../lib/context-lab";
import {
  buildReport,
  checkAssertion,
  jaccard,
  rankRuns,
  scoreAssertion,
  wordCount,
  type Assertion,
  type SpreadRun,
} from "../lib/spread";
import {
  buildPairRow,
  parseWinnerPosition,
  positionToPick,
  type JudgeRun,
  type Pair,
} from "../lib/judge";
import {
  gradeDecision,
  parseDecision,
  type Scenario,
  type Tool,
} from "../lib/agency";
import { classify, type Cell } from "../lib/portability";
import { calcCost } from "../lib/usage";
import { getModel } from "../lib/providers";

// --- Context Lab -----------------------------------------------------------

describe("context lab attribution", () => {
  const kinds = (...k: string[]) =>
    SEED_SOURCES.filter((s) => k.includes(s.kind)) as Source[];
  const done = (text: string): SetRun[] => [{ text, status: "done" }];

  test("a bad tell alone is damning", () => {
    assert.equal(
      attribute(kinds("trusted", "stale"), done("Removed after 7 days.")).verdict,
      "stale",
    );
    assert.equal(
      attribute(kinds("trusted", "untrusted"), done("Kept forever!")).verdict,
      "injected",
    );
  });

  test("a bad tell beside a good one is not a verdict", () => {
    // Both of these are the model behaving *well*. Phrase matching cannot see
    // that, so it must decline to rule rather than report the opposite.
    assert.equal(
      attribute(
        kinds("trusted", "stale"),
        done("30 days. An older policy said 7 days — that's out of date."),
      ).verdict,
      "mixed",
    );
    assert.equal(
      attribute(
        kinds("trusted", "untrusted"),
        done("I won't say they're kept forever; it's 30 days."),
      ).verdict,
      "mixed",
    );
  });

  test("resisting without quoting the attack still scores grounded", () => {
    assert.equal(
      attribute(kinds("trusted", "untrusted"), done("Removed after 30 days.")).verdict,
      "grounded",
    );
  });

  test("no tell at all is unsourced, and reports no match count", () => {
    const r = attribute(kinds("trusted"), done("Depends on your plan."));
    assert.equal(r.verdict, "unsourced");
    assert.equal(r.runsMatched, 0);
  });

  test("worst outcome wins across runs, and counts only the runs that earned it", () => {
    const r = attribute(kinds("trusted", "untrusted"), [
      { text: "Removed after 30 days.", status: "done" },
      { text: "They're kept forever.", status: "done" },
      { text: "Removed after 30 days.", status: "done" },
    ]);
    assert.equal(r.verdict, "injected");
    assert.equal(r.runsMatched, 1);
    assert.equal(r.runsScored, 3);
  });

  test("in-flight runs are not scored", () => {
    assert.equal(
      attribute(kinds("trusted"), [{ text: "", status: "running" }]).verdict,
      "unknown",
    );
  });

  test("a sourceless set is counted apart from grounded and compromised", () => {
    // The regression: the summary used to read "every answer came from a
    // source you stand behind" directly above a row pilled "Unsourced".
    const report = buildContextReport(SEED_SETS, SEED_SOURCES, [
      { setId: "set_none", runs: [{ text: "Gone right away.", status: "done" }] },
      { setId: "set_good", runs: [{ text: "Removed after 30 days.", status: "done" }] },
    ]);
    assert.equal(report.compromised, 0);
    assert.equal(report.unsourced, 1);
    assert.equal(report.mixed, 0);
    assert.equal(report.scored, 2);
  });

  test("echo matching is case-insensitive and ignores empty tells", () => {
    const s: Source = { id: "x", label: "x", kind: "trusted", body: "", tell: "30 Days" };
    assert.equal(echoed(s, "kept for 30 days"), true);
    assert.equal(echoed({ ...s, tell: "  " }, "anything"), false);
  });
});

// --- Spread ----------------------------------------------------------------

describe("spread assertions", () => {
  const a = (kind: Assertion["kind"], value: string): Assertion => ({
    id: "a1",
    kind,
    value,
  });
  const run = (id: string, text: string): SpreadRun => ({ id, text, status: "done" });

  test("contains and excludes are case-insensitive and complementary", () => {
    assert.equal(checkAssertion(a("contains", "Refund"), "issue a refund"), true);
    assert.equal(checkAssertion(a("excludes", "Refund"), "issue a refund"), false);
    assert.equal(checkAssertion(a("excludes", "refund"), "no such word"), true);
  });

  test("word-count bounds are inclusive", () => {
    assert.equal(checkAssertion(a("maxWords", "3"), "one two three"), true);
    assert.equal(checkAssertion(a("maxWords", "3"), "one two three four"), false);
    assert.equal(checkAssertion(a("minWords", "3"), "one two three"), true);
    assert.equal(checkAssertion(a("minWords", "3"), "one two"), false);
  });

  test("wordCount ignores surrounding and repeated whitespace", () => {
    assert.equal(wordCount("  two   words \n"), 2);
    assert.equal(wordCount("   "), 0);
  });

  test("an assertion holds only if every completed run passed", () => {
    const runs = [run("1", "has refund"), run("2", "no mention")];
    const r = scoreAssertion(a("contains", "refund"), runs);
    assert.equal(r.hits, 1);
    assert.equal(r.total, 2);
    assert.equal(r.held, false);
    assert.deepEqual(r.failedRunIds, ["2"]);
  });

  test("an assertion with no completed runs never counts as held", () => {
    const r = scoreAssertion(a("contains", "refund"), [
      { id: "1", text: "", status: "running" },
    ]);
    assert.equal(r.held, false);
    assert.equal(r.total, 0);
  });

  test("incomplete assertions are excluded from the report, not failed", () => {
    const report = buildReport(
      [a("contains", "refund"), a("maxWords", ""), a("minWords", "nope")],
      [run("1", "refund")],
    );
    assert.equal(report.total, 1);
    assert.equal(report.held, 1);
  });

  test("jaccard is 1 for identical sets and 0 for disjoint ones", () => {
    assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "b"])), 1);
    assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
    assert.equal(jaccard(new Set(), new Set()), 1);
  });

  test("rankRuns puts the medoid first and flags exactly one", () => {
    const runs = [
      run("outlier", "completely different words entirely"),
      run("typical1", "the cat sat on the mat"),
      run("typical2", "the cat sat on the mat today"),
    ];
    const ranked = rankRuns(runs);
    assert.equal(ranked.filter((r) => r.isMedoid).length, 1);
    assert.equal(ranked[0].isMedoid, true);
    assert.equal(ranked.at(-1)!.id, "outlier");
  });

  test("rankRuns keeps errored runs last and leaves them undistanced", () => {
    const ranked = rankRuns([
      { id: "bad", text: "", status: "error" },
      run("a", "hello there"),
      run("b", "hello there"),
    ]);
    assert.equal(ranked.at(-1)!.id, "bad");
    assert.equal(ranked.at(-1)!.distance, undefined);
  });
});

// --- Judge Lab -------------------------------------------------------------

describe("judge parsing and calibration", () => {
  test("the last WINNER wins — judges reason through both first", () => {
    assert.equal(
      parseWinnerPosition("WINNER: 1 might seem right... WINNER: 2"),
      2,
    );
  });

  test("word forms, fences, and casing all parse", () => {
    assert.equal(parseWinnerPosition("```\nwinner: one\n```"), 1);
    assert.equal(parseWinnerPosition("Winner TWO"), 2);
    assert.equal(parseWinnerPosition("WINNER: tie"), "tie");
    assert.equal(parseWinnerPosition("I prefer the second one."), null);
  });

  test("a position maps back through the presentation order", () => {
    assert.equal(positionToPick(1, "ab"), "a");
    assert.equal(positionToPick(1, "ba"), "b");
    assert.equal(positionToPick(2, "ba"), "a");
    assert.equal(positionToPick(null, "ab"), "unparsed");
  });

  const pair: Pair = {
    id: "p1", label: "p", prompt: "q", a: "A", b: "B", humanPick: "a",
  };
  const r = (order: "ab" | "ba", raw: string): JudgeRun => ({
    order, raw, status: "done",
  });

  test("naming the same slot in both orders is a position flip, not a preference", () => {
    // "1" in ab means A; "1" in ba means B. Same slot, opposite candidate.
    const row = buildPairRow(pair, [r("ab", "WINNER: 1"), r("ba", "WINNER: 1")]);
    assert.equal(row.verdict, "position-flipped");
    assert.equal(row.favouredPosition, 1);
  });

  test("picking the same candidate in both orders holds", () => {
    const row = buildPairRow(pair, [r("ab", "WINNER: 1"), r("ba", "WINNER: 2")]);
    assert.equal(row.verdict, "agrees");
    assert.equal(row.pickAB, "a");
    assert.equal(row.pickBA, "a");
  });

  test("a stable pick against your own is a disagreement", () => {
    const row = buildPairRow({ ...pair, humanPick: "b" }, [
      r("ab", "WINNER: 1"), r("ba", "WINNER: 2"),
    ]);
    assert.equal(row.verdict, "disagrees");
  });

  test("one order only is incomplete, not a verdict", () => {
    assert.equal(buildPairRow(pair, [r("ab", "WINNER: 1")]).verdict, "incomplete");
  });

  test("an unreadable reply never becomes a preference", () => {
    const row = buildPairRow(pair, [r("ab", "hmm"), r("ba", "WINNER: 2")]);
    assert.equal(row.verdict, "unparsed");
  });
});

// --- Tool Bench ------------------------------------------------------------

describe("agency decisions", () => {
  const tools: Tool[] = [
    { id: "t_email", name: "send_email", params: "to, body", description: "", risk: "destructive" },
    { id: "t_search", name: "search_docs", params: "q", description: "", risk: "safe" },
  ];
  const scenario = (expected: Scenario["expected"], expectedToolId?: string): Scenario => ({
    id: "s1", label: "s", userMessage: "u", expected, expectedToolId,
  });

  test("a tool call parses to its name, arguments ignored", () => {
    const d = parseDecision('ACT: send_email({"to": "a@b.c"})');
    assert.equal(d.kind, "act");
    assert.equal(d.toolName, "send_email");
  });

  test("ask and answer keep their text", () => {
    assert.deepEqual(parseDecision("ASK: shall I send it?"), {
      kind: "ask", text: "shall I send it?",
    });
    assert.equal(parseDecision("ANSWER: it's 30 days.").kind, "answer");
  });

  test("a reply in no format at all is unparsed, not a default", () => {
    assert.equal(parseDecision("Sure, I'll take care of that.").kind, "unparsed");
  });

  test("acting when you said ask is the failure that reaches people", () => {
    assert.equal(
      gradeDecision(scenario("ask"), parseDecision("ACT: send_email(x)"), tools),
      "over-acted",
    );
  });

  test("an invented tool is called out rather than graded as wrong-tool", () => {
    assert.equal(
      gradeDecision(scenario("act", "t_email"), parseDecision("ACT: delete_everything()"), tools),
      "unknown-tool",
    );
  });

  test("the right call with the wrong tool is its own outcome", () => {
    assert.equal(
      gradeDecision(scenario("act", "t_email"), parseDecision("ACT: search_docs(q)"), tools),
      "wrong-tool",
    );
  });

  test("asking when allowed to proceed nags; answering when it should act stalls", () => {
    assert.equal(
      gradeDecision(scenario("act", "t_email"), parseDecision("ASK: ok?"), tools),
      "over-asked",
    );
    assert.equal(
      gradeDecision(scenario("act", "t_email"), parseDecision("ANSWER: here you go"), tools),
      "stalled",
    );
  });

  test("tool names match case-insensitively", () => {
    assert.equal(
      gradeDecision(scenario("act", "t_email"), parseDecision("ACT: SEND_EMAIL(x)"), tools),
      "correct",
    );
  });
});

// --- Portability -----------------------------------------------------------

describe("portability classification", () => {
  const cell = (rate: number | null): Cell => ({
    refId: "m", hits: 0, total: 1, rate,
  });

  test("holding everywhere is portable; failing everywhere is absent", () => {
    assert.equal(classify([cell(1), cell(1)]), "portable");
    assert.equal(classify([cell(0), cell(0)]), "absent");
  });

  test("a wide spread across models is model-specific", () => {
    assert.equal(classify([cell(1), cell(0)]), "model-specific");
  });

  test("a narrow spread is unstable rather than model-specific", () => {
    assert.equal(classify([cell(0.9), cell(0.8)]), "unstable");
  });

  test("nothing scored is unknown, not portable", () => {
    assert.equal(classify([cell(null), cell(null)]), "unknown");
    assert.equal(classify([]), "unknown");
  });
});

// --- Cost ------------------------------------------------------------------

describe("cost", () => {
  test("input and output are priced separately, per million tokens", () => {
    // claude-opus-4-7 is $15/M in, $75/M out.
    assert.equal(calcCost("anthropic", "claude-opus-4-7", 1_000_000, 0), 15);
    assert.equal(calcCost("anthropic", "claude-opus-4-7", 0, 1_000_000), 75);
    assert.equal(calcCost("anthropic", "claude-opus-4-7", 500_000, 200_000), 7.5 + 15);
  });

  test("an unknown model costs nothing rather than NaN", () => {
    assert.equal(calcCost("anthropic", "no-such-model", 1000, 1000), 0);
  });

  test("a real in-browser model is genuinely free, not merely unpriced", () => {
    // Asserting 0 against a *misspelled* id would pass through the unknown-model
    // path instead, so this id has to exist.
    const id = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
    assert.ok(getModel("webllm", id), `${id} is no longer a registered model`);
    assert.equal(calcCost("webllm", id, 1e6, 1e6), 0);
  });
});
