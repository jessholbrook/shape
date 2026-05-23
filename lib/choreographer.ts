export type AssistantResult = {
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  startMs?: number;
  endMs?: number;
  /** Reviewer note about how this turn played. */
  note?: string;
};

export type ChoreographedTurn = {
  id: string;
  userMessage: string;
  assistant: AssistantResult;
};

export const EMPTY_ASSISTANT: AssistantResult = {
  text: "",
  status: "idle",
};

/**
 * Seed flow that exercises multi-turn coherence:
 * - turn 1 sets context (research mentor)
 * - turn 2 follow-up that depends on the answer
 * - turn 3 asks the model to reconsider — does it gracefully revise?
 * - turn 4 contradiction check — does it remember its own earlier answer?
 */
export const SEED_TURNS: ChoreographedTurn[] = [
  {
    id: "t1",
    userMessage:
      "I'm running my first user interview tomorrow. What's the one thing I should not do?",
    assistant: { ...EMPTY_ASSISTANT },
  },
  {
    id: "t2",
    userMessage:
      "Could you give me an example of that mistake, worded the way I might catch myself saying it?",
    assistant: { ...EMPTY_ASSISTANT },
  },
  {
    id: "t3",
    userMessage:
      "What if my participant gives a one-word answer? Should I push harder?",
    assistant: { ...EMPTY_ASSISTANT },
  },
  {
    id: "t4",
    userMessage:
      "Wait — earlier you told me to avoid leading questions. Is asking 'could you say more?' a leading question?",
    assistant: { ...EMPTY_ASSISTANT },
  },
];

export const DEFAULT_CHOREOGRAPHER_PROMPT = `You are a research mentor who's run hundreds of interviews. You speak warmly but cut to it. You answer one question per turn — short, specific. When the user follows up, you reference what you just said rather than repeating it. If they ask you to reconsider, you do so plainly, without backpedaling on the parts that still hold.`;

export function newTurnId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `t_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function makeEmptyTurn(): ChoreographedTurn {
  return {
    id: newTurnId(),
    userMessage: "",
    assistant: { ...EMPTY_ASSISTANT },
  };
}

/** Build the message history to send to the provider before turn `index`. */
export function buildHistoryUpTo(
  turns: ChoreographedTurn[],
  index: number,
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < index; i++) {
    const t = turns[i];
    out.push({ role: "user", content: t.userMessage });
    if (t.assistant.status === "done" && t.assistant.text) {
      out.push({ role: "assistant", content: t.assistant.text });
    }
  }
  return out;
}

/** Count how many turns have a completed assistant response. */
export function completedTurnCount(turns: ChoreographedTurn[]): number {
  return turns.filter((t) => t.assistant.status === "done").length;
}
