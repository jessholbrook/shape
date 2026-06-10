export type ToneStop = -2 | -1 | 0 | 1 | 2;

export type ToneDimension = {
  id: ToneDimensionId;
  label: string;
  blurb: string;
  /** 5 entries indexed by stop + 2. Each is { label (chip), prompt (instruction line) }. */
  stops: { label: string; prompt: string | null }[];
};

export type ToneDimensionId =
  | "warmth"
  | "verbosity"
  | "energy"
  | "directness"
  | "concreteness";

export type ToneValues = Record<ToneDimensionId, ToneStop>;

export const DEFAULT_TONE: ToneValues = {
  warmth: 0,
  verbosity: 0,
  energy: 0,
  directness: 0,
  concreteness: 0,
};

export const TONE_DIMENSIONS: ToneDimension[] = [
  {
    id: "warmth",
    label: "Warmth",
    blurb: "Cool and impersonal ↔ warm and personal",
    stops: [
      {
        label: "Clinical",
        prompt:
          "Keep an impersonal, clinical register. Avoid friendliness or first-person warmth.",
      },
      {
        label: "Reserved",
        prompt: "Stay neutral and professional. Skip small talk and pleasantries.",
      },
      { label: "Neutral", prompt: null },
      {
        label: "Warm",
        prompt:
          "Be warm and approachable. Sound like a person, not a brand voice.",
      },
      {
        label: "Personal",
        prompt:
          "Lean very warm and personal — write like you're talking to a friend you genuinely care about.",
      },
    ],
  },
  {
    id: "verbosity",
    label: "Verbosity",
    blurb: "Terse ↔ generous with detail",
    stops: [
      {
        label: "Terse",
        prompt:
          "Be extremely terse. One sentence when possible. Cut every word that doesn't earn its place.",
      },
      {
        label: "Brief",
        prompt: "Stay brief. Prefer short sentences over long ones.",
      },
      { label: "Neutral", prompt: null },
      {
        label: "Generous",
        prompt:
          "Take the space you need to be clear. Explain reasoning when it helps the reader.",
      },
      {
        label: "Expansive",
        prompt:
          "Be generous with detail — give context, examples, and nuance. Don't worry about length.",
      },
    ],
  },
  {
    id: "energy",
    label: "Energy",
    blurb: "Composed ↔ playful",
    stops: [
      {
        label: "Composed",
        prompt:
          "Stay composed and measured. Avoid exclamation, enthusiasm, or playful phrasing.",
      },
      {
        label: "Steady",
        prompt: "Keep an even, steady tone. No flourishes.",
      },
      { label: "Neutral", prompt: null },
      {
        label: "Lively",
        prompt: "Bring some energy. A touch of playfulness is welcome.",
      },
      {
        label: "Playful",
        prompt:
          "Be bright and playful. Have fun with language — wordplay and warmth allowed.",
      },
    ],
  },
  {
    id: "directness",
    label: "Directness",
    blurb: "Hedged ↔ blunt",
    stops: [
      {
        label: "Hedged",
        prompt:
          "Hedge your claims. Use 'might', 'could', 'perhaps'. Offer options rather than recommendations.",
      },
      {
        label: "Soft",
        prompt: "Soften strong claims. Acknowledge uncertainty where it exists.",
      },
      { label: "Neutral", prompt: null },
      {
        label: "Direct",
        prompt: "Be direct. Make a recommendation when one is warranted.",
      },
      {
        label: "Blunt",
        prompt:
          "Be very direct. State your view clearly and stand behind it without softening.",
      },
    ],
  },
  {
    id: "concreteness",
    label: "Concreteness",
    blurb: "Abstract ↔ specific",
    stops: [
      {
        label: "Conceptual",
        prompt:
          "Speak in concepts and principles. Avoid getting into specifics or examples.",
      },
      {
        label: "High-level",
        prompt: "Keep things at a high level. Specifics only when essential.",
      },
      { label: "Neutral", prompt: null },
      {
        label: "Grounded",
        prompt: "Ground claims in concrete examples and specifics.",
      },
      {
        label: "Specific",
        prompt:
          "Be extremely concrete. Every claim should come with a specific example or detail.",
      },
    ],
  },
];

export const TONE_BY_ID: Record<ToneDimensionId, ToneDimension> =
  TONE_DIMENSIONS.reduce((acc, dim) => {
    acc[dim.id] = dim;
    return acc;
  }, {} as Record<ToneDimensionId, ToneDimension>);

/** Single-letter accent for each dimension. Used to color-link dials to the
 *  composed-prompt lines they produced. */
export const TONE_INITIAL: Record<ToneDimensionId, string> = {
  warmth: "W",
  verbosity: "V",
  energy: "E",
  directness: "D",
  concreteness: "C",
};

export function stopLabel(id: ToneDimensionId, stop: ToneStop): string {
  return TONE_BY_ID[id].stops[stop + 2].label;
}

export type ToneLine = { dim: ToneDimensionId; text: string };

/** Return per-dial lines that make up the tone block, in stable order. Empty
 *  if all dials are at neutral. The line text is the raw instruction, no list
 *  bullet — render it however the UI wants. */
export function composeToneLines(values: ToneValues): ToneLine[] {
  const out: ToneLine[] = [];
  for (const dim of TONE_DIMENSIONS) {
    const prompt = dim.stops[values[dim.id] + 2].prompt;
    if (prompt) out.push({ dim: dim.id, text: prompt });
  }
  return out;
}

/**
 * Compose the tone-instructions block from current dial values.
 * Returns null if all dimensions are at neutral.
 */
export function composeToneBlock(values: ToneValues): string | null {
  const lines = composeToneLines(values);
  if (lines.length === 0) return null;
  return `Tone:\n${lines.map((l) => `- ${l.text}`).join("\n")}`;
}

/**
 * Compose the full system prompt: base brief + tone block.
 */
export function composeSystemPrompt(brief: string, values: ToneValues): string {
  const tone = composeToneBlock(values);
  const trimmed = brief.trim();
  if (!tone) return trimmed;
  if (!trimmed) return tone;
  return `${trimmed}\n\n${tone}`;
}
