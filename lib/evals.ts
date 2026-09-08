export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export type Score = 1 | 2 | 3 | 4 | 5;

export const SCORE_LABELS: Record<Score, string> = {
  1: "Fails",
  2: "Weak",
  3: "OK",
  4: "Good",
  5: "Excels",
};

export type Criterion = {
  id: string;
  name: string;
  description: string;
};

export type EvalCase = {
  id: string;
  label: string;
  userMessage: string;
};

export type CaseResult = {
  output: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  startMs?: number;
  endMs?: number;
  /** Score per criterion id. */
  scores: Record<string, Score | null>;
  note?: string;
};

export const EMPTY_CASE_RESULT: CaseResult = {
  output: "",
  status: "idle",
  scores: {},
};

export const SEED_CRITERIA: Criterion[] = [
  {
    id: "clarity",
    name: "Clarity",
    description: "Easy to understand on the first read. No ambiguity.",
  },
  {
    id: "tone",
    name: "Tone",
    description: "Matches the brand voice. Warm without sliding into chirpy.",
  },
  {
    id: "completeness",
    name: "Completeness",
    description: "Covers what the user needs in this moment — nothing missing.",
  },
  {
    id: "actionability",
    name: "Actionability",
    description: "The user knows what to do next without having to guess.",
  },
  {
    id: "conciseness",
    name: "Conciseness",
    description: "No wasted words. Earns every sentence.",
  },
];

export const SEED_CASES: EvalCase[] = [
  {
    id: "empty-state",
    label: "Empty state",
    userMessage:
      "Write the empty-state copy for a notes app the first time someone opens it. No notes yet.",
  },
  {
    id: "payment-error",
    label: "Payment error",
    userMessage:
      "Write an error message for a checkout when the credit card has expired.",
  },
  {
    id: "welcome",
    label: "Welcome message",
    userMessage:
      "Write a first-screen welcome message for a new user signing up to a journaling app.",
  },
];

export const DEFAULT_EVAL_SYSTEM_PROMPT = `You are writing UX copy. Be warm but precise. Short sentences. No filler. Speak directly to the reader.`;

/**
 * Aggregate score per case = sum of scored criteria / (criteria count × max).
 * Returns null until at least one criterion is scored.
 */
export function caseScore(
  criteria: Criterion[],
  result: CaseResult,
): { total: number; max: number; scored: number } | null {
  let total = 0;
  let scored = 0;
  for (const c of criteria) {
    const v = result.scores[c.id];
    if (typeof v === "number") {
      total += v;
      scored += 1;
    }
  }
  if (scored === 0) return null;
  return { total, max: criteria.length * SCORE_MAX, scored };
}

/**
 * Aggregate across all cases. Returns avg score per case (out of max), plus
 * fully-scored count and how many criteria slots are filled total.
 */
export function aggregateScore(
  criteria: Criterion[],
  cases: EvalCase[],
  results: Record<string, CaseResult>,
): {
  avg: number | null;
  max: number;
  fullyScoredCases: number;
  filledSlots: number;
  totalSlots: number;
} {
  const max = criteria.length * SCORE_MAX;
  let sum = 0;
  let fullyScoredCases = 0;
  let filledSlots = 0;
  const totalSlots = criteria.length * cases.length;
  for (const c of cases) {
    const result = results[c.id] ?? EMPTY_CASE_RESULT;
    const score = caseScore(criteria, result);
    if (score) {
      filledSlots += score.scored;
      if (score.scored === criteria.length) {
        fullyScoredCases += 1;
        sum += score.total;
      }
    }
  }
  const avg = fullyScoredCases > 0 ? sum / fullyScoredCases : null;
  return { avg, max, fullyScoredCases, filledSlots, totalSlots };
}

export function newCriterionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `c_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// --- Design mode ------------------------------------------------------------------

/**
 * Eval Lab runs in two directions. "Apply a rubric" is the original: the
 * rubric is fixed, the outputs vary, and the reader scores what the model
 * produced. "Design a rubric" is the inversion two testers asked for
 * independently: the outputs are fixed — some clearly strong, some weak —
 * and the experiment is writing criteria that *separate* them the way a
 * careful reader would.
 *
 * In real evaluation work the hard part isn't scoring, it's deciding what
 * to measure. This mode makes that the task. No model is needed: the
 * outputs are seeded, the scoring is by hand, and the check is whether the
 * rubric's totals reproduce a ranking the reader only sees afterwards.
 */

export type EvalMode = "apply" | "design";

export type DesignOutput = {
  id: string;
  /** Neutral label shown before the reveal. */
  label: string;
  text: string;
  /** 1 is best. Hidden until the reader has scored. */
  truthRank: number;
  /** The argument for that rank, shown on reveal. */
  why: string;
};

export type DesignSet = {
  id: string;
  title: string;
  /** Context the outputs were written for. */
  brief: string;
  /** The prompt every output answers. */
  userMessage: string;
  outputs: DesignOutput[];
};

/**
 * Four replies to one prompt, in an order that isn't the ranking. The trap
 * is deliberate: a "friendliness" criterion ranks the chirpy one first, and
 * the reveal says so.
 */
export const SEED_DESIGN_SET: DesignSet = {
  id: "expired-card",
  title: "Expired card at checkout",
  brief:
    "A checkout page for an online store. The card on file has expired and the payment did not go through.",
  userMessage:
    "Write the error message for a checkout when the credit card has expired.",
  outputs: [
    {
      id: "o1",
      label: "Output 1",
      text: "Payment failed. Please try again.",
      truthRank: 4,
      why: "Says nothing about what went wrong or what to do. Trying again with the same card fails the same way, so the one instruction it gives is wrong.",
    },
    {
      id: "o2",
      label: "Output 2",
      text: "Your card has expired. Update the expiry date or use a different card to finish checkout.",
      truthRank: 1,
      why: "Names the cause, gives two exits, and wastes no words. Warm enough without performing warmth.",
    },
    {
      id: "o3",
      label: "Output 3",
      text: "Oops! Looks like something went a little sideways with your card 😅 No worries at all — these things happen! Just pop in some fresh details and we'll get you back on track in a jiffy!",
      truthRank: 3,
      why: "Actionable, eventually, but it never says the card expired, and it is cheerful about somebody's money. A friendliness criterion ranks this first — which is the trap.",
    },
    {
      id: "o4",
      label: "Output 4",
      text: "We were unable to process your payment because the credit card associated with your account has passed its expiration date. To proceed, please navigate to your payment settings and provide updated card information, then return to complete your purchase.",
      truthRank: 2,
      why: "Correct and complete, at twice the length it needs, and it sends the user to settings and back instead of fixing it here.",
    },
  ],
};

/** Scores by output id, then by criterion id. */
export type DesignScores = Record<string, Record<string, Score | null>>;

export function emptyDesignScores(set: DesignSet): DesignScores {
  const out: DesignScores = {};
  for (const o of set.outputs) out[o.id] = {};
  return out;
}

/** Sum of a rubric's scores for one output, or null until every criterion is scored. */
export function designTotal(
  criteria: Criterion[],
  scores: Record<string, Score | null> | undefined,
): number | null {
  if (!scores || criteria.length === 0) return null;
  let total = 0;
  for (const c of criteria) {
    const v = scores[c.id];
    if (typeof v !== "number") return null;
    total += v;
  }
  return total;
}

export type PairTally = {
  concordant: number;
  discordant: number;
  ties: number;
  /** Pairs where both outputs had a value. */
  pairs: number;
};

/**
 * Every pair of outputs, compared two ways: which the truth ranks higher,
 * and which the given values rank higher. Values are "higher is better";
 * truth ranks are "lower is better". A pair with a missing value is skipped.
 */
export function tallyPairs(
  values: Record<string, number | null>,
  outputs: DesignOutput[],
): PairTally {
  const tally: PairTally = { concordant: 0, discordant: 0, ties: 0, pairs: 0 };
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      const a = outputs[i];
      const b = outputs[j];
      const va = values[a.id];
      const vb = values[b.id];
      if (va == null || vb == null) continue;
      tally.pairs++;
      // `better` is the one the truth prefers.
      const [better, worse] = a.truthRank < b.truthRank ? [va, vb] : [vb, va];
      if (better > worse) tally.concordant++;
      else if (better < worse) tally.discordant++;
      else tally.ties++;
    }
  }
  return tally;
}

export type CriterionVerdict =
  | "separating"
  | "mixed"
  | "flat"
  | "inverted"
  | "crowns-wrong"
  | "unscored";

export const CRITERION_VERDICT_LABEL: Record<CriterionVerdict, string> = {
  separating: "Separates them",
  mixed: "Partly",
  flat: "Flat",
  inverted: "Pulls the wrong way",
  "crowns-wrong": "Crowns the wrong output",
  unscored: "Not fully scored",
};

export const CRITERION_VERDICT_BLURB: Record<CriterionVerdict, string> = {
  separating:
    "Orders nearly every pair the way the truth does. This criterion is doing the work.",
  mixed:
    "Right about some pairs, wrong or tied about others. It measures something, just not cleanly.",
  flat: "Scores every output within a point of each other. It isn't separating anything here — dead weight in the total.",
  inverted:
    "Rewards the outputs the truth ranks lower. Either the criterion is measuring the wrong thing, or the truth is — decide which.",
  "crowns-wrong":
    "Gives its top score to an output a careful reader ranks below the best. It sounds right and rewards the wrong thing — the criterion to argue about.",
  unscored: "Score every output on this criterion to diagnose it.",
};

export type CriterionDiagnosis = {
  criterion: Criterion;
  verdict: CriterionVerdict;
  /** Highest score minus lowest, across the outputs. */
  spread: number;
  tally: PairTally;
};

/**
 * One criterion, judged by whether it separates the outputs and which way.
 * Spread first: a criterion that gives everything the same score can't be
 * concordant or discordant, only inert. Then the top: a criterion whose
 * highest score lands on an output the reader ranks below the best is the
 * seed's trap, and it gets named even when it is right about the rest.
 */
export function diagnoseCriterion(
  criterion: Criterion,
  outputs: DesignOutput[],
  scores: DesignScores,
): CriterionDiagnosis {
  const values: Record<string, number | null> = {};
  let allScored = true;
  for (const o of outputs) {
    const v = scores[o.id]?.[criterion.id];
    values[o.id] = typeof v === "number" ? v : null;
    if (typeof v !== "number") allScored = false;
  }
  const tally = tallyPairs(values, outputs);
  if (!allScored) return { criterion, verdict: "unscored", spread: 0, tally };
  const nums = outputs.map((o) => values[o.id] as number);
  const spread = Math.max(...nums) - Math.min(...nums);
  const best = outputs.find((o) => o.truthRank === 1);
  const bestScore = best ? (values[best.id] as number) : Infinity;
  const crownsWrong = outputs.some(
    (o) => o.truthRank > 1 && (values[o.id] as number) > bestScore,
  );
  let verdict: CriterionVerdict;
  if (spread <= 1) verdict = "flat";
  else if (tally.discordant > tally.concordant) verdict = "inverted";
  else if (crownsWrong) verdict = "crowns-wrong";
  else if (tally.concordant >= tally.pairs - 1) verdict = "separating";
  else verdict = "mixed";
  return { criterion, verdict, spread, tally };
}

export type DesignRankedOutput = {
  output: DesignOutput;
  total: number | null;
  max: number;
  /** Position by the rubric's totals, 1 = highest. Null until scored. */
  rubricRank: number | null;
};

export type DesignReport = {
  ranked: DesignRankedOutput[];
  /** Rubric totals against the truth. */
  tally: PairTally;
  fullyScored: boolean;
  criteria: CriterionDiagnosis[];
  separating: number;
  flat: number;
  /** Inverted or crowning the wrong output — the ones pulling against the reader. */
  wrongWay: number;
};

export function buildDesignReport(
  criteria: Criterion[],
  set: DesignSet,
  scores: DesignScores,
): DesignReport {
  const max = criteria.length * SCORE_MAX;
  const totals: Record<string, number | null> = {};
  for (const o of set.outputs) totals[o.id] = designTotal(criteria, scores[o.id]);

  const scoredOutputs = set.outputs
    .filter((o) => totals[o.id] !== null)
    .sort((a, b) => (totals[b.id] as number) - (totals[a.id] as number));
  const rankOf = new Map<string, number>();
  scoredOutputs.forEach((o, i) => {
    // Equal totals share a rank.
    const prev = scoredOutputs[i - 1];
    rankOf.set(
      o.id,
      prev && totals[prev.id] === totals[o.id] ? (rankOf.get(prev.id) as number) : i + 1,
    );
  });

  const ranked: DesignRankedOutput[] = [...set.outputs]
    .sort((a, b) => {
      const ta = totals[a.id];
      const tb = totals[b.id];
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1;
      if (tb === null) return -1;
      return tb - ta;
    })
    .map((output) => ({
      output,
      total: totals[output.id],
      max,
      rubricRank: rankOf.get(output.id) ?? null,
    }));

  const diagnoses = criteria.map((c) => diagnoseCriterion(c, set.outputs, scores));
  return {
    ranked,
    tally: tallyPairs(totals, set.outputs),
    fullyScored: set.outputs.every((o) => totals[o.id] !== null),
    criteria: diagnoses,
    separating: diagnoses.filter((d) => d.verdict === "separating").length,
    flat: diagnoses.filter((d) => d.verdict === "flat").length,
    wrongWay: diagnoses.filter(
      (d) => d.verdict === "inverted" || d.verdict === "crowns-wrong",
    ).length,
  };
}
