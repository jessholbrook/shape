import type { ProviderId } from "./providers";

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
  /**
   * The criterion the reader is invited to add — the set's trap. Shown
   * before the reveal as a suggestion, never as a warning.
   */
  hint: string;
  /** What the set is for, shown with the report once the truth is out. */
  lesson: string;
  outputs: DesignOutput[];
};

/**
 * Four replies to one prompt, in an order that isn't the ranking. The trap
 * is deliberate: a "friendliness" criterion ranks the chirpy one first, and
 * the reveal says so. The Part I rubric separates these on its own.
 */
export const SEED_DESIGN_SET: DesignSet = {
  id: "expired-card",
  title: "Expired card at checkout",
  brief:
    "A checkout page for an online store. The card on file has expired and the payment did not go through.",
  userMessage:
    "Write the error message for a checkout when the credit card has expired.",
  hint: "Friendliness",
  lesson:
    "The Part I rubric separates these on its own. The trap is the criterion you were invited to add: friendliness is right that the terse reply is bad and wrong that the chirpy one is best — and a criterion that crowns the wrong output drags the total with it.",
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

/**
 * The second set's trap is confidence. The assistant cannot know the answer,
 * and one reply gives it anyway — warmly, specifically, and wrong. The Part I
 * rubric has no criterion for truth, so scored honestly it ranks the invented
 * promise above the useless-but-honest policy paragraph. A "directness"
 * criterion makes that worse; a criterion for saying only what it knows is
 * the fix, and it only wins once the form criteria stop outvoting it.
 */
export const DELIVERY_DESIGN_SET: DesignSet = {
  id: "delivery-by-friday",
  title: "Delivery by Friday?",
  brief:
    "A support assistant inside a shopping app. It can see the order — shipped Tuesday, standard shipping, which the store quotes as 3–5 business days — but it has no carrier tracking and no delivery estimate of its own.",
  userMessage: "Will my order get here by Friday? It's a birthday present.",
  hint: "Directness",
  lesson:
    "The Part I rubric has no criterion for truth. Clarity and conciseness score the invented promise as well as the honest replies, so criteria about form outvote the one thing that matters here. Add a criterion for saying only what it knows — then ask which of the others are worth keeping.",
  outputs: [
    {
      id: "o1",
      label: "Output 1",
      text: "I can't confirm a delivery date. Your order shipped Tuesday by standard shipping, which is 3–5 business days. The tracking link in your shipping confirmation email has the carrier's estimate.",
      truthRank: 2,
      why: "Every fact is right and it promises nothing it can't keep. But the user said why Friday matters, and this doesn't hear it — no next step if the estimate is bad, no offer. Honest, and finished with them.",
    },
    {
      id: "o2",
      label: "Output 2",
      text: "Yes! Your order will arrive by Friday. Standard shipping takes 2–3 days and your package is already on its way, so it'll be there in time for the birthday. 🎁",
      truthRank: 4,
      why: "Confident, warm, specific, and invented. The assistant has no delivery estimate, and the store quotes 3–5 days, not 2–3. If the parcel comes Monday, the user skipped a backup because a bot said yes. A criterion that rewards a straight answer ranks this first — which is the trap.",
    },
    {
      id: "o3",
      label: "Output 3",
      text: "I can't promise Friday. It shipped Tuesday by standard shipping, which is 3–5 business days, so Friday is possible but not certain. The tracking link in your confirmation email will show the carrier's estimate. If that says it'll miss, reply here and we'll look at options.",
      truthRank: 1,
      why: "Says what it knows, says what it doesn't, and gives the two things the user can act on: where the real estimate lives, and what to do if it's bad. It heard \"birthday\". Not the shortest reply, but every sentence carries something.",
    },
    {
      id: "o4",
      label: "Output 4",
      text: "Delivery times vary depending on carrier, destination, and order volume. We are unable to guarantee delivery dates. Please refer to our shipping policy for further information.",
      truthRank: 3,
      why: "Nothing in it is false and nothing in it is usable. It ignores the order it can see, doesn't say where the estimate lives, and answers a person with a policy. Still above the confident promise: the user at least leaves knowing they don't know.",
    },
  ],
};

/**
 * The third set's trap is already in the rubric the reader starts with.
 * Conciseness crowns the confirmation that is short because it left out what
 * a factory reset costs — and a second length criterion, the one the reader
 * is invited to add, doubles the damage. Length is a virtue only once the
 * message has said what's at stake.
 */
export const RESET_DESIGN_SET: DesignSet = {
  id: "factory-reset",
  title: "Factory reset",
  brief:
    "A smart-home app. The user tapped \"Factory reset\" on a thermostat that holds their heating schedules and scenes and is paired to their account.",
  userMessage: "Write the confirmation dialog shown before the reset goes ahead.",
  hint: "Brevity",
  lesson:
    "Conciseness is in the rubric you started with, and here it crowns the reply that hides what a reset costs. A confirmation that is short because it left out the consequence isn't concise, it's incomplete — length is only a virtue once the message has said what's at stake. Add a criterion for naming the consequence, and ask whether two length criteria deserve a vote each.",
  outputs: [
    {
      id: "o1",
      label: "Output 1",
      text: "Warning: Performing a factory reset will permanently remove all user-configured settings, schedules, scenes, and account associations from this device and restore it to its original out-of-box state. This action cannot be reversed. Please ensure that you have exported any configurations you wish to retain prior to proceeding. Do you wish to continue?",
      truthRank: 3,
      why: "Everything the user needs is in here, in the voice of a terms-of-service page. It warns, which puts it above the reply that doesn't, and it makes the user work for the warning.",
    },
    {
      id: "o2",
      label: "Output 2",
      text: "This erases the thermostat's schedules and scenes and unpairs it from your account. You can back them up first in Settings › Backup. Reset anyway?",
      truthRank: 1,
      why: "Names what is lost, says how to keep it, and asks. Three sentences, each carrying something the user needs before they tap.",
    },
    {
      id: "o3",
      label: "Output 3",
      text: "Reset this device?",
      truthRank: 4,
      why: "The shortest reply, and the one that costs the most: a user who taps through loses every schedule without having been told. A conciseness criterion ranks this first — which is the trap, and it was in your rubric from the start.",
    },
    {
      id: "o4",
      label: "Output 4",
      text: "Heads up — resetting wipes this thermostat's schedules and scenes and removes it from your account. There's no undo. Reset it?",
      truthRank: 2,
      why: "Warm, complete about what is lost, honest that there is no undo. It gives the user no way to keep their schedules, which is the one thing the best reply adds.",
    },
  ],
};

/** Every seeded set, in the order the picker shows them. The first is the default. */
export const DESIGN_SETS: DesignSet[] = [SEED_DESIGN_SET, DELIVERY_DESIGN_SET, RESET_DESIGN_SET];

/** The set with that id, or the default when a draft names one that no longer exists. */
export function designSetById(id: string | undefined): DesignSet {
  return DESIGN_SETS.find((s) => s.id === id) ?? DESIGN_SETS[0];
}

// --- Generated sets ---------------------------------------------------------------

/**
 * The seeded sets come with our ranking. A generated set comes with none: a
 * model writes four replies to the reader's own brief at temperature 1 — the
 * model's spread, not its best attempt — and the reader ranks them *before*
 * writing a criterion. That ranking is the truth the rubric is checked
 * against, so the report can't say whether the ranking was right, only
 * whether the rubric measures what the reader used when they made it. The
 * careful reader is you.
 */

export const GENERATED_SET_ID = "generated";
export const GENERATION_TEMPERATURE = 1;
export const GENERATED_COUNT = 4;

export type GeneratedOutput = {
  id: string;
  label: string;
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
};

export type GeneratedSet = {
  /** The surface the copy is for — becomes the writer's system prompt. */
  brief: string;
  /** The request every reply answers. */
  userMessage: string;
  /** What wrote the replies, for the record. */
  provider: ProviderId;
  model: string;
  outputs: GeneratedOutput[];
  /** The reader's ranking by output id, 1 = best. Set before any scoring. */
  ranks: Record<string, number>;
};

export const DEFAULT_GENERATED_BRIEF =
  "A banking app. The user tried to send money to a friend and the transfer failed because they have reached their daily transfer limit.";
export const DEFAULT_GENERATED_USER_MESSAGE =
  "Write the message the user sees when the transfer fails because they've hit the daily limit.";

export function emptyGeneratedOutputs(): GeneratedOutput[] {
  return Array.from({ length: GENERATED_COUNT }, (_, i) => ({
    id: `g${i + 1}`,
    label: `Output ${i + 1}`,
    text: "",
    status: "idle" as const,
  }));
}

export function emptyGeneratedSet(provider: ProviderId, model: string): GeneratedSet {
  return {
    brief: DEFAULT_GENERATED_BRIEF,
    userMessage: DEFAULT_GENERATED_USER_MESSAGE,
    provider,
    model,
    outputs: emptyGeneratedOutputs(),
    ranks: {},
  };
}

/**
 * The writer's system prompt. It gets the surface and nothing about quality:
 * the point is four honest samples, not four deliberately varied ones.
 */
export function composeGenerationSystem(brief: string): string {
  const surface = brief.trim() || "a product screen";
  return [
    "You are writing the copy a product shows its user.",
    `The surface: ${surface}`,
    "Reply with the text the user would see and nothing else — no preamble, no options, no commentary.",
  ].join("\n");
}

/** True once every written output has a distinct rank from 1 to n. */
export function rankingComplete(set: GeneratedSet): boolean {
  return rankingProblem(set) === null;
}

/**
 * Why the ranking isn't usable yet, in a sentence, or null when it is. A
 * rank given to two outputs is the common slip, so it is named.
 */
export function rankingProblem(set: GeneratedSet): string | null {
  const written = set.outputs.filter((o) => o.status === "done" && o.text.trim());
  if (written.length < 2) return "Write the replies first.";
  const ranks = written.map((o) => set.ranks[o.id]);
  const seen = new Map<number, number>();
  for (const r of ranks) if (typeof r === "number") seen.set(r, (seen.get(r) ?? 0) + 1);
  for (const [r, n] of seen) if (n > 1) return `Two outputs are both ${ordinalWord(r)} — every rank once.`;
  const missing = ranks.filter((r) => typeof r !== "number").length;
  if (missing > 0) return `Rank ${missing === written.length ? "every output" : `${missing} more output${missing === 1 ? "" : "s"}`} first.`;
  return null;
}

function ordinalWord(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th", "6th"][n - 1] ?? `${n}th`;
}

export const GENERATED_LESSON =
  "This ranking is yours, so the report can't say whether it was right — only whether the rubric measures what you used when you made it. Criteria that come out flat are the ones you didn't actually use. If nothing separates them, the four may simply be the same quality, and a total that says otherwise is noise.";

/**
 * The generated replies as a design set. Only written outputs are included;
 * an unranked one gets rank 0, which is why callers gate on
 * `rankingComplete` before reading a report. The reader's note on each
 * output stands in for the seeded sets' "why".
 */
export function setFromGenerated(
  set: GeneratedSet,
  notes: Record<string, string> = {},
): DesignSet {
  return {
    id: GENERATED_SET_ID,
    title: "Your own set",
    brief: set.brief,
    userMessage: set.userMessage,
    hint: "the thing you actually used to rank them",
    lesson: GENERATED_LESSON,
    outputs: set.outputs
      .filter((o) => o.status === "done" && o.text.trim())
      .map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
        truthRank: set.ranks[o.id] ?? 0,
        why: notes[o.id]?.trim() ?? "",
      })),
  };
}

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
