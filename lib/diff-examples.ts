/**
 * Curated A/B starter pairs for Diff Mode. Each isolates a single design lever
 * so a new user can see, in one click, what kind of variance a system prompt
 * (or temperature) produces. Presets set only system prompts + temperature —
 * the user's chosen provider/model is preserved.
 *
 * Each preset ships with a recorded sample run so a first-time visitor can
 * feel the contrast instantly — before any model has downloaded and without a
 * key. The samples are clearly labeled as recorded, with "Run it live" as the
 * follow-up.
 */
export type DiffExample = {
  id: string;
  /** Chip label — self-describing, e.g. "Warm vs Blunt". */
  name: string;
  /** The design lever this pair demonstrates. Shown as "What to notice". */
  lever: string;
  systemA: string;
  systemB: string;
  tempA: number;
  tempB: number;
  /** A user message that makes the contrast obvious. */
  message: string;
  /** Recorded outputs for the message above — shown as a sample run. */
  sample: { outputA: string; outputB: string };
  /**
   * Optional recorded multi-sample spread. When present, the sample card shows
   * several runs per config instead of one — the only way to *see* what
   * temperature does: a low-temp config repeats almost verbatim, a high-temp
   * config rerolls each time. A definition can't teach this; a spread can.
   */
  sampleSpread?: { outputsA: string[]; outputsB: string[] };
};

export const DIFF_EXAMPLES: DiffExample[] = [
  {
    id: "warm-vs-blunt",
    name: "Warm vs Blunt",
    lever:
      "Voice & tone — same task, opposite bedside manner. Notice how A spends its first sentence on the person and B spends it on the fix.",
    systemA:
      "You are a customer support agent. Lead with empathy — acknowledge how the person feels before anything else. Warm, reassuring, human.",
    systemB:
      "You are a customer support agent. Be blunt and efficient. State the facts and the fix in as few words as possible. No pleasantries.",
    tempA: 0.7,
    tempB: 0.7,
    message: "I accidentally deleted my account. Can I get it back?",
    sample: {
      outputA:
        "Oh no — that sinking feeling when something important disappears is the worst, so let's get this sorted together. The good news: deleted accounts stay recoverable for 30 days. Head to Settings → Restore Account and sign in with your original email, and everything — your files, history, and preferences — will come back exactly as you left it.",
      outputB:
        "Yes, if it was deleted within the last 30 days. Go to Settings → Restore Account and sign in with your original email. After 30 days the data is permanently removed.",
    },
  },
  {
    id: "terse-vs-expansive",
    name: "Terse vs Expansive",
    lever:
      "Verbosity — one sentence vs the full tour. Notice B isn't just longer; it adds an analogy, a mechanism, and a caveat A never had room for.",
    systemA: "Answer in a single sentence. Never more.",
    systemB:
      "Explain thoroughly. Give context, a concrete example, and one caveat. Take all the space you need.",
    tempA: 0.5,
    tempB: 0.5,
    message: "What is a webhook?",
    sample: {
      outputA:
        "A webhook is an automated message one app sends to another the moment something happens.",
      outputB:
        "A webhook is a way for one application to notify another the instant something happens, instead of the second app having to ask over and over. Think of tracking a package: polling is you refreshing the tracking page every hour; a webhook is the text message that arrives the moment it's delivered. Concretely, you give a service a URL you control, and when an event occurs — a payment clears, a form is submitted — the service sends an HTTP request with the details to that URL. One caveat: webhooks arrive whether or not your server is ready, so real systems need retries and verification on the receiving end.",
    },
  },
  {
    id: "prose-vs-bullets",
    name: "Prose vs Bullets",
    lever:
      "Output formatting — same content, different shape. Notice which one you actually finished reading, and which one you could act on faster.",
    systemA:
      "Reply in one short paragraph of flowing prose. No lists, no headings.",
    systemB:
      "Reply as a tight bulleted list. Bold the key term at the start of each bullet.",
    tempA: 0.6,
    tempB: 0.6,
    message: "How should I prepare for my first user interview?",
    sample: {
      outputA:
        "Start by writing down the two or three things you genuinely need to learn, then draft open questions that invite stories rather than confirm your hunches. Do a quick dry run with a colleague to catch leading questions, test your recording setup, and plan to spend the first few minutes putting the participant at ease before anything substantive.",
      outputB:
        "- **Goals** — write down the 2–3 things you need to learn before drafting a single question.\n- **Open questions** — ask for stories (\"tell me about the last time…\"), not opinions.\n- **Dry run** — pilot with a colleague to catch leading questions.\n- **Logistics** — test recording, prep consent, arrive early.\n- **Warm-up** — budget five easy minutes before the real questions.",
    },
  },
  {
    id: "temp-low-vs-high",
    name: "Temp 0.1 vs 1.0",
    lever:
      "Temperature — identical prompt, low vs high randomness. Notice A plays it safe and predictable while B takes a swing that could delight or miss.",
    systemA: "You are a brand copywriter. Write a single one-line tagline.",
    systemB: "You are a brand copywriter. Write a single one-line tagline.",
    tempA: 0.1,
    tempB: 1.0,
    message: "A tagline for a meditation app made for busy parents.",
    sample: {
      outputA: "Find your calm in the chaos of parenting.",
      outputB:
        "Five stolen minutes, fully yours — breathe before the next snack request.",
    },
    sampleSpread: {
      // Temp 0.1 — three samples, nearly identical run to run.
      outputsA: [
        "Find your calm in the chaos of parenting.",
        "Find your calm in the chaos of parenting.",
        "Find calm in the chaos of parenting.",
      ],
      // Temp 1.0 — three samples, a different swing each time.
      outputsB: [
        "Five stolen minutes, fully yours — breathe before the next snack request.",
        "Because “I just need a minute” deserves an app that gives you one.",
        "Peace, tucked into the pauses between pickups and lunchboxes.",
      ],
    },
  },
  {
    id: "same-vs-same",
    name: "Same vs Same",
    lever:
      "The control. These configs are identical — any difference between the outputs is sampling randomness, not your design. Feel the size of that randomness here, and discount it before you credit a prompt change in any other comparison.",
    systemA: "You are a brand copywriter. Write a single one-line tagline.",
    systemB: "You are a brand copywriter. Write a single one-line tagline.",
    tempA: 0.8,
    tempB: 0.8,
    message:
      "A tagline for a neighborhood coffee shop that roasts its own beans.",
    sample: {
      outputA: "Roasted here, poured here, loved here.",
      outputB: "Your corner of the block, freshly roasted.",
    },
  },
];
