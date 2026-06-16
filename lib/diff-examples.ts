/**
 * Curated A/B starter pairs for Diff Mode. Each isolates a single design lever
 * so a new user can see, in one click, what kind of variance a system prompt
 * (or temperature) produces. Presets set only system prompts + temperature —
 * the user's chosen provider/model is preserved.
 */
export type DiffExample = {
  id: string;
  /** Chip label — self-describing, e.g. "Warm vs Blunt". */
  name: string;
  /** The design lever this pair demonstrates (shown as a hint). */
  lever: string;
  systemA: string;
  systemB: string;
  tempA: number;
  tempB: number;
  /** A user message that makes the contrast obvious. */
  message: string;
};

export const DIFF_EXAMPLES: DiffExample[] = [
  {
    id: "warm-vs-blunt",
    name: "Warm vs Blunt",
    lever: "Voice & tone — same task, opposite bedside manner",
    systemA:
      "You are a customer support agent. Lead with empathy — acknowledge how the person feels before anything else. Warm, reassuring, human.",
    systemB:
      "You are a customer support agent. Be blunt and efficient. State the facts and the fix in as few words as possible. No pleasantries.",
    tempA: 0.7,
    tempB: 0.7,
    message: "I accidentally deleted my account. Can I get it back?",
  },
  {
    id: "terse-vs-expansive",
    name: "Terse vs Expansive",
    lever: "Verbosity — one sentence vs the full tour",
    systemA: "Answer in a single sentence. Never more.",
    systemB:
      "Explain thoroughly. Give context, a concrete example, and one caveat. Take all the space you need.",
    tempA: 0.5,
    tempB: 0.5,
    message: "What is a webhook?",
  },
  {
    id: "prose-vs-bullets",
    name: "Prose vs Bullets",
    lever: "Output formatting — same content, different shape",
    systemA:
      "Reply in one short paragraph of flowing prose. No lists, no headings.",
    systemB:
      "Reply as a tight bulleted list. Bold the key term at the start of each bullet.",
    tempA: 0.6,
    tempB: 0.6,
    message: "How should I prepare for my first user interview?",
  },
  {
    id: "temp-low-vs-high",
    name: "Temp 0.1 vs 1.0",
    lever: "Temperature — identical prompt, low vs high randomness",
    systemA: "You are a brand copywriter. Write a single one-line tagline.",
    systemB: "You are a brand copywriter. Write a single one-line tagline.",
    tempA: 0.1,
    tempB: 1.0,
    message: "A tagline for a meditation app made for busy parents.",
  },
];
