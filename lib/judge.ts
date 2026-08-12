import { PROVIDERS, type ProviderId } from "./providers";

/**
 * Judge Lab automates the scoring you did by hand in Eval Lab — and then
 * immediately checks whether the automation can be trusted.
 *
 * The check is the point. A judge that agrees with you most of the time looks
 * like a working instrument, and the way you find out it isn't is by asking
 * the same question twice with the two answers swapped. A judge reading
 * quality gives the same verdict both times. A judge reading *position* gives
 * the same verdict both times too — it just isn't the same answer.
 *
 * Which is why agreement is reported second here. On its own it's the more
 * flattering number and the less informative one.
 */

export type Pair = {
  id: string;
  label: string;
  /** The question both candidates are answering. */
  prompt: string;
  a: string;
  b: string;
  /** Your own call, made before the judge runs. Ground truth, such as it is. */
  humanPick: "a" | "b" | null;
};

/** Which candidate the judge chose, already mapped back out of position. */
export type Pick = "a" | "b" | "tie" | "unparsed";

/** Presentation order — "ba" shows candidate B first. */
export type Order = "ab" | "ba";

export type JudgeRun = {
  order: Order;
  raw: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

export type PairResult = {
  pairId: string;
  runs: JudgeRun[];
};

export const MAX_PAIRS = 6;
export const MIN_PAIRS = 1;

export function newJudgeId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

// --- Prompt assembly -------------------------------------------------------

export const JUDGE_INSTRUCTIONS = `Compare the two answers and decide which is better.

End your reply with exactly one line:
WINNER: 1
WINNER: 2
WINNER: TIE`;

export function composeJudgeSystem(criteria: string): string {
  const parts = ["You are evaluating two candidate answers to the same request."];
  if (criteria.trim()) parts.push(`What matters:\n${criteria.trim()}`);
  parts.push(JUDGE_INSTRUCTIONS);
  return parts.join("\n\n");
}

/**
 * The two candidates in a given presentation order. Numbered rather than
 * lettered so the judge never sees a label that hints at which is "first" in
 * our data — the whole experiment depends on the two orders being
 * indistinguishable to it.
 */
export function composeJudgeTurn(pair: Pair, order: Order): string {
  const first = order === "ab" ? pair.a : pair.b;
  const second = order === "ab" ? pair.b : pair.a;
  return `Request:\n${pair.prompt.trim()}\n\nAnswer 1:\n${first.trim()}\n\nAnswer 2:\n${second.trim()}`;
}

// --- Parsing ---------------------------------------------------------------

/** Which *position* the judge named, before mapping back to a candidate. */
export function parseWinnerPosition(raw: string): 1 | 2 | "tie" | null {
  const cleaned = raw.replace(/```[a-zA-Z]*\n?/g, "").replace(/```/g, "");
  // Last mention wins — judges often reason through both before concluding.
  const matches = [...cleaned.matchAll(/WINNER\s*:?\s*(1|2|TIE|ONE|TWO)/gi)];
  if (matches.length === 0) return null;
  const token = matches[matches.length - 1][1].toUpperCase();
  if (token === "TIE") return "tie";
  if (token === "1" || token === "ONE") return 1;
  return 2;
}

/** Map a position back to the candidate it actually referred to. */
export function positionToPick(
  position: 1 | 2 | "tie" | null,
  order: Order,
): Pick {
  if (position === null) return "unparsed";
  if (position === "tie") return "tie";
  if (order === "ab") return position === 1 ? "a" : "b";
  return position === 1 ? "b" : "a";
}

export function pickFromRun(run: JudgeRun): Pick {
  if (run.status !== "done") return "unparsed";
  return positionToPick(parseWinnerPosition(run.raw), run.order);
}

// --- Calibration -----------------------------------------------------------

export type PairVerdict =
  | "agrees"
  | "disagrees"
  | "position-flipped"
  | "tie"
  | "unparsed"
  | "incomplete";

export const VERDICT_LABEL: Record<PairVerdict, string> = {
  agrees: "Held, and agrees",
  disagrees: "Held, but disagrees",
  "position-flipped": "Flipped when swapped",
  tie: "Called it a tie",
  unparsed: "No clear verdict",
  incomplete: "Not run both ways",
};

export const VERDICT_BLURB: Record<PairVerdict, string> = {
  agrees:
    "Same answer in both orders, and the same one you picked. This is what a usable judge looks like.",
  disagrees:
    "Same answer in both orders, but not yours. A stable disagreement — worth reading, and often a sign your criteria are vague rather than that the judge is wrong.",
  "position-flipped":
    "Chose a different answer when the order changed. It was reading position, not quality — this verdict carries no information.",
  tie: "Wouldn't separate them. Sometimes honest, sometimes a way of avoiding the question.",
  unparsed: "Didn't produce a verdict in the format asked for.",
  incomplete: "Needs a run in both orders before it can be checked.",
};

export type PairRow = {
  pair: Pair;
  runs: JudgeRun[];
  pickAB: Pick;
  pickBA: Pick;
  verdict: PairVerdict;
  /**
   * When it flipped, the position it favoured — 1 if it named the first
   * answer both times, 2 if the second, null if it flipped some other way.
   */
  favouredPosition: 1 | 2 | null;
};

function runFor(runs: JudgeRun[], order: Order): JudgeRun | undefined {
  return runs.find((r) => r.order === order);
}

export function buildPairRow(pair: Pair, runs: JudgeRun[]): PairRow {
  const ab = runFor(runs, "ab");
  const ba = runFor(runs, "ba");
  const pickAB = ab ? pickFromRun(ab) : "unparsed";
  const pickBA = ba ? pickFromRun(ba) : "unparsed";

  const bothDone = ab?.status === "done" && ba?.status === "done";
  let verdict: PairVerdict;
  let favouredPosition: 1 | 2 | null = null;

  if (!bothDone) {
    verdict = "incomplete";
  } else if (pickAB === "unparsed" || pickBA === "unparsed") {
    verdict = "unparsed";
  } else if (pickAB === "tie" || pickBA === "tie") {
    verdict = "tie";
  } else if (pickAB !== pickBA) {
    verdict = "position-flipped";
    // It flipped. Did it simply name the same slot both times?
    const posAB = parseWinnerPosition(ab!.raw);
    const posBA = parseWinnerPosition(ba!.raw);
    if (posAB === posBA && (posAB === 1 || posAB === 2)) {
      favouredPosition = posAB;
    }
  } else if (pair.humanPick === null) {
    // Stable, but there's nothing to agree or disagree with.
    verdict = "disagrees";
  } else {
    verdict = pickAB === pair.humanPick ? "agrees" : "disagrees";
  }

  return { pair, runs, pickAB, pickBA, verdict, favouredPosition };
}

export type JudgeReport = {
  rows: PairRow[];
  /** Pairs with a run in both orders. */
  scored: number;
  flipped: number;
  agrees: number;
  /** Pairs that both held steady and had a human pick to compare against. */
  comparable: number;
  /** Position the judge favoured across the flips, when it favoured one. */
  favouredPosition: 1 | 2 | null;
  favouredCount: number;
};

export function buildJudgeReport(
  pairs: Pair[],
  results: PairResult[],
): JudgeReport {
  const rows = pairs.map((p) =>
    buildPairRow(p, results.find((r) => r.pairId === p.id)?.runs ?? []),
  );
  const scored = rows.filter((r) => r.verdict !== "incomplete").length;
  const flipped = rows.filter((r) => r.verdict === "position-flipped");

  // Did the flips share a direction? Three flips all naming answer 1 is a
  // different finding from three flips that scatter.
  const firsts = flipped.filter((r) => r.favouredPosition === 1).length;
  const seconds = flipped.filter((r) => r.favouredPosition === 2).length;
  let favouredPosition: 1 | 2 | null = null;
  let favouredCount = 0;
  if (firsts > 0 && firsts >= seconds) {
    favouredPosition = 1;
    favouredCount = firsts;
  } else if (seconds > 0) {
    favouredPosition = 2;
    favouredCount = seconds;
  }

  return {
    rows,
    scored,
    flipped: flipped.length,
    agrees: rows.filter((r) => r.verdict === "agrees").length,
    comparable: rows.filter(
      (r) =>
        (r.verdict === "agrees" || r.verdict === "disagrees") &&
        r.pair.humanPick !== null,
    ).length,
    favouredPosition,
    favouredCount,
  };
}

/**
 * Every pair is judged twice, so cost is double what a naive scoring run
 * would be. That is the price of knowing whether the first number meant
 * anything.
 */
export function estimateJudgeCost(
  provider: ProviderId,
  model: string,
  system: string,
  pairs: Pair[],
): number {
  const meta = PROVIDERS[provider].models.find((m) => m.id === model);
  if (!meta) return 0;
  const assumedOutput = 120;
  return pairs.reduce((sum, pair) => {
    const turn = composeJudgeTurn(pair, "ab");
    const inputTokens = Math.ceil((system.length + turn.length) / 4);
    const perRun =
      (inputTokens / 1_000_000) * meta.inputPer1M +
      (assumedOutput / 1_000_000) * meta.outputPer1M;
    return sum + perRun * 2;
  }, 0);
}

// --- Seeds -----------------------------------------------------------------

export const SEED_CRITERIA = `Clarity — easy to act on after one read.
Commitment — says what will actually happen, not what might.
Brevity — no filler, no restating the question back.`;

/**
 * Pairs are seeded so the shorter answer is the better one in each case.
 * That's deliberate: length bias is the most common failure in an automated
 * judge, and a seed where the good answer is also the longest would hide it.
 */
export const SEED_PAIRS: Pair[] = [
  {
    id: "pair_delivery",
    label: "Late delivery",
    prompt:
      "A customer's order hasn't arrived and they leave on a trip tomorrow. Write the support reply.",
    a: "Your order is out for delivery and should arrive by 6pm today. If it hasn't landed by then, reply here and I'll refund it straight away so you're not out of pocket before your trip.",
    b: "Thank you so much for reaching out to us about your order, and I'm truly sorry to hear that it hasn't arrived yet. I completely understand how frustrating this must be, especially with your trip coming up tomorrow. Let me look into this for you right away. Our records indicate that the package is currently in transit and making its way through our delivery network. Delivery times can occasionally vary depending on a number of factors. I would recommend keeping an eye on your tracking information, and please don't hesitate to reach out again if you have any further questions or concerns.",
    humanPick: "a",
  },
  {
    id: "pair_empty",
    label: "Empty state",
    prompt:
      "Write the empty state for a project list, before the user has made anything.",
    a: "No projects yet. Create one to get started.",
    b: "It looks like you don't have any projects in your workspace at the moment! Projects are a great way to organise your work and collaborate with your team. When you're ready, you can create your very first project using the button below, and you'll be up and running in no time.",
    humanPick: "a",
  },
  {
    id: "pair_error",
    label: "Payment failure",
    prompt: "Write the error message when a card payment is declined.",
    a: "Your bank declined the payment. Try another card, or contact your bank — we don't get told why.",
    b: "Unfortunately, we were unable to process your payment at this time. There are many possible reasons why a payment might not go through, including insufficient funds, an expired card, or your bank's own fraud-prevention systems. We'd recommend double-checking your card details and trying again, or getting in touch with your financial institution for more information about this particular transaction.",
    humanPick: "a",
  },
];
