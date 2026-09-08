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
  | "concreteness"
  | "structure";

export type ToneValues = Record<ToneDimensionId, ToneStop>;

export const DEFAULT_TONE: ToneValues = {
  warmth: 0,
  verbosity: 0,
  energy: 0,
  directness: 0,
  concreteness: 0,
  structure: 0,
};

/**
 * Fill in dials that didn't exist when a draft was saved (e.g. drafts from
 * before the Structure dial shipped) so old drafts hydrate without crashing
 * and new dials read as Neutral.
 */
export function normalizeToneValues(values: Partial<ToneValues>): ToneValues {
  return { ...DEFAULT_TONE, ...values };
}

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
  {
    id: "structure",
    label: "Structure",
    blurb: "Flowing prose ↔ headed sections",
    stops: [
      {
        label: "Prose",
        prompt:
          "Write in flowing prose paragraphs only. No lists, headings, or tables.",
      },
      {
        label: "Prose-first",
        prompt:
          "Prefer paragraphs. Use a list only when it clearly beats prose.",
      },
      { label: "Neutral", prompt: null },
      {
        label: "Scannable",
        prompt:
          "Prefer structure: short bullets with a bold lead-in word where it helps scanning.",
      },
      {
        label: "Sectioned",
        prompt:
          "Structure the reply with short headed sections and tight bullets. No long paragraphs.",
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
  structure: "S",
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

// --- Reverse mode ------------------------------------------------------------

/**
 * Reverse mode runs the dial backwards: the designer edits a reply into what
 * they actually wanted, and the model infers which stops would produce it.
 *
 * The inference is a *proposal*, never a setting. It arrives as a diff
 * against the current dials with one line of reasoning per dial, and the
 * designer accepts or adjusts it. Presenting an inference as fact would teach
 * exactly the overconfidence Module 08 warns about — so the proposal is also
 * checkable: run it forward and put the result next to the target.
 */

export type InferredTone = {
  values: ToneValues;
  /** One short line per dial citing the target, when the model gave one. */
  why: Partial<Record<ToneDimensionId, string>>;
};

export type ToneMode = "forward" | "reverse";

/**
 * A target that reads distinctly off neutral on several dials — warm,
 * brief, composed, prose — so the first inference has something to find.
 * Pairs with the default brief (meditation-app onboarding) and message.
 */
export const DEFAULT_TARGET =
  "Welcome in. There's nothing to get right today — find somewhere comfortable, and we'll take the first minute together.";

/**
 * The dial definitions, rendered for the model. Every stop's instruction is
 * included so the inference is anchored to what the dials actually do rather
 * than to the model's own idea of "warm" or "direct".
 */
function composeDialReference(): string {
  return TONE_DIMENSIONS.map((dim) => {
    const stops = dim.stops
      .map((s, i) => {
        const n = i - 2;
        const num = n > 0 ? ` ${n}` : `${n}`;
        return `  ${num.padStart(3)} ${s.label}: ${s.prompt ?? "adds no instruction"}`;
      })
      .join("\n");
    return `${dim.label} — ${dim.blurb}\n${stops}`;
  }).join("\n\n");
}

export function composeInferencePrompt(): string {
  const shape = TONE_DIMENSIONS.map((d) => `"${d.id}": 0`).join(", ");
  const why = TONE_DIMENSIONS.map(
    (d) => `"${d.id}": "<one short sentence citing the target>"`,
  ).join(", ");
  return [
    "You are calibrating a set of tone dials. A designer wrote or edited a reply by hand; your job is to infer which dial settings would most likely produce a reply like it.",
    "There are six dials. Each has five stops, numbered -2 to 2. Stop 0 adds no instruction; every other stop adds the instruction shown.",
    composeDialReference(),
    "Read the brief, the user message, and the target reply. For each dial, pick the stop whose instruction the target reply most looks like it followed. Use 0 when the target gives no evidence either way. Describe the reply you were given, not the one you would have written.",
    `Reply with JSON only, in exactly this shape:\n{${shape}, "why": {${why}}}`,
  ].join("\n\n");
}

export function composeInferenceUserTurn(
  brief: string,
  userMessage: string,
  target: string,
): string {
  return [
    `Brief:\n${brief.trim() || "(none)"}`,
    `User message:\n${userMessage.trim() || "(none)"}`,
    `Target reply:\n${target.trim()}`,
  ].join("\n\n");
}

function clampStop(n: unknown): ToneStop | null {
  const v = typeof n === "string" ? Number(n) : n;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(-2, Math.min(2, Math.round(v))) as ToneStop;
}

/**
 * Lenient on purpose: code fences and a leading sentence are tolerated, and a
 * missing dial reads as 0. A reply with no dial keys at all is `null` — the
 * model didn't make a proposal, and pretending it did would be a fabricated
 * setting.
 */
export function parseInferredTone(raw: string): InferredTone | null {
  const cleaned = raw
    .replace(/```[a-zA-Z]*\n?/g, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;

  const values: ToneValues = { ...DEFAULT_TONE };
  let found = 0;
  for (const dim of TONE_DIMENSIONS) {
    const stop = clampStop(obj[dim.id]);
    if (stop !== null) {
      values[dim.id] = stop;
      found++;
    }
  }
  if (found === 0) return null;

  const why: InferredTone["why"] = {};
  const rawWhy = obj.why;
  if (rawWhy && typeof rawWhy === "object") {
    for (const dim of TONE_DIMENSIONS) {
      const line = (rawWhy as Record<string, unknown>)[dim.id];
      if (typeof line === "string" && line.trim()) why[dim.id] = line.trim();
    }
  }
  return { values, why };
}

export type DialChange = { dim: ToneDimensionId; from: ToneStop; to: ToneStop };

/** The dials a proposal would move, in dial order. */
export function proposalChanges(
  current: ToneValues,
  proposed: ToneValues,
): DialChange[] {
  const out: DialChange[] = [];
  for (const dim of TONE_DIMENSIONS) {
    if (current[dim.id] !== proposed[dim.id]) {
      out.push({ dim: dim.id, from: current[dim.id], to: proposed[dim.id] });
    }
  }
  return out;
}

export function sameTone(a: ToneValues, b: ToneValues): boolean {
  return TONE_DIMENSIONS.every((dim) => a[dim.id] === b[dim.id]);
}

// --- What a rule can read off the target --------------------------------------

export type TargetSignal = {
  /** Short chip text. */
  label: string;
  /** The dial this bears on. */
  dim: ToneDimensionId;
};

const HEDGES =
  /\b(might|could|perhaps|maybe|possibly|seems?|likely|arguably|i think|it depends)\b/gi;
const EXAMPLES = /\b(for example|for instance|e\.g\.|such as)\b|\d+/gi;
const READER = /\b(you|your|you're|yours)\b/gi;

function count(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

/**
 * The mechanical facts a rule can read off the target without a model —
 * length, structure, exclamation, hedging, address, specifics. Shown next to
 * the proposal so the reader can see which dials the model had to *judge*
 * (warmth, energy) and which it could have *counted* (verbosity, structure).
 * Same boundary as Spread's assertions: mechanical drift is checkable,
 * tonal drift is not.
 */
export function readTargetSignals(target: string): TargetSignal[] {
  const text = target.trim();
  if (!text) return [];
  const words = (text.match(/\S+/g) ?? []).length;
  const sentences = Math.max(
    1,
    (text.match(/[^.!?\n]+[.!?]+(\s|$)/g) ?? []).length,
  );
  const lines = text.split("\n");
  const listItems = lines.filter((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l)).length;
  const headings = lines.filter((l) => /^\s*#{1,6}\s+\S/.test(l)).length;
  const exclamations = count(text, /!/g);
  const hedges = count(text, HEDGES);
  const reader = count(text, READER);
  const specifics = count(text, EXAMPLES);

  const plural = (n: number, one: string, many = `${one}s`) =>
    `${n} ${n === 1 ? one : many}`;

  return [
    {
      label: `${plural(words, "word")} · ${plural(sentences, "sentence")}`,
      dim: "verbosity",
    },
    {
      label:
        listItems === 0 && headings === 0
          ? "no lists or headings"
          : [
              listItems > 0 ? plural(listItems, "list item") : null,
              headings > 0 ? plural(headings, "heading") : null,
            ]
              .filter(Boolean)
              .join(" · "),
      dim: "structure",
    },
    {
      label:
        exclamations === 0
          ? "no exclamation marks"
          : plural(exclamations, "exclamation mark"),
      dim: "energy",
    },
    {
      label: hedges === 0 ? "no hedges" : plural(hedges, "hedge"),
      dim: "directness",
    },
    {
      label:
        reader === 0 ? "never addresses the reader" : `addresses the reader ${reader}×`,
      dim: "warmth",
    },
    {
      label:
        specifics === 0
          ? "no numbers or examples"
          : plural(specifics, "number or example", "numbers or examples"),
      dim: "concreteness",
    },
  ];
}
