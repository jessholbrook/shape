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
