/**
 * Lenses — who the reader is, and which bridge they cross to get here.
 *
 * Shape's playgrounds are shared. What changes per audience is the on-ramp:
 * the "you already do X → now do it to a model" framing that makes a new
 * idea land on top of an old skill. UX is one lens among several, not the
 * default; a reader with no lens sees the neutral core.
 *
 * Pure data. The hook that reads and persists the active lens is
 * `lib/hooks/use-lens.ts`; the content-consistency tests check that every
 * href here resolves to a real route.
 */

export type LensId = "ux" | "policy" | "philosophy" | "education";

export type Bridge = {
  /** What the reader already does, in their own terms. */
  kicker: string;
  /** What Shape lets them do with that skill, pointed at a model. */
  statement: string;
  /** Internal route the card opens. */
  href: string;
};

export type LensContent = {
  hero: { lede: string };
  bridgeHeading: { before: string; italic: string };
  bridgeIntro: string;
  bridges: [Bridge, Bridge, Bridge];
  /** Ordered internal routes — lessons and playgrounds — to start with. */
  path: string[];
};

export type Lens = LensContent & {
  id: LensId;
  /** Full name, e.g. "Policy & governance". */
  name: string;
  /** Short chip label for the picker. */
  short: string;
  /** One line for the lens's landing page and its metadata. */
  tagline: string;
};

/** What a reader with no lens sees. Every lens falls back to these ideas. */
export const CORE: LensContent = {
  hero: {
    lede: "A hands-on lab for understanding how AI models behave — and how that behavior gets made. Change one thing, run it again, and see what moves: tone, persona, boundaries, values. It's not about using AI to do your work; it's about learning to question and direct the model itself.",
  },
  bridgeHeading: { before: "You already have the", italic: "instincts" },
  bridgeIntro:
    "Whatever you do, you already ask questions, weigh answers, and draw lines. Shape lets you point those skills at a model and see what it actually does.",
  bridges: [
    {
      kicker: "You ask questions.",
      statement: "Now ask one of a model ten times, and see the spread.",
      href: "/play/spread",
    },
    {
      kicker: "You compare two answers.",
      statement: "Now change one thing and watch what moves.",
      href: "/play/diff",
    },
    {
      kicker: "You draw lines.",
      statement: "Now see where a model draws them.",
      href: "/play/refusal",
    },
  ],
  path: [
    "/learn/prompts-as-design",
    "/play/diff",
    "/learn/distributions-not-outputs",
    "/play/spread",
    "/learn/refusal-and-boundaries",
    "/play/refusal",
  ],
};

export const LENSES: Record<LensId, Lens> = {
  ux: {
    id: "ux",
    name: "UX design & research",
    short: "UX",
    tagline:
      "Personas, microcopy, usability rubrics, A/B tests — the skills you already use are the foundation of designing how a model behaves.",
    hero: {
      lede: "You already design how products behave. Now design how the model behaves — its tone, persona, and boundaries — using the craft you already have.",
    },
    bridgeHeading: { before: "You already think like a", italic: "behavior designer" },
    bridgeIntro:
      "The skills you use every day are the foundation of shaping AI. This site helps you make the connections and try it out.",
    bridges: [
      {
        kicker: "You define personas.",
        statement: "Now design one for the model itself.",
        href: "/play/persona",
      },
      {
        kicker: "You write microcopy.",
        statement: "Now write the system prompt that produces it.",
        href: "/play/tone",
      },
      {
        kicker: "You run A/B tests.",
        statement: "Now diff two prompts side-by-side.",
        href: "/play/diff",
      },
    ],
    path: [
      "/learn/prompts-as-design",
      "/play/diff",
      "/learn/voice-and-tone",
      "/play/tone",
      "/learn/personas-for-ai",
      "/play/persona",
    ],
  },
  policy: {
    id: "policy",
    name: "Policy & governance",
    short: "Policy",
    tagline:
      "You write rules, audit systems, and ask whether a standard holds everywhere it applies. Do the same to a model — and see where its rules bend.",
    hero: {
      lede: "Rules for AI get written in policy documents. Behavior gets made somewhere else — in prompts, specs, and evaluations. See where the two meet, and where they don't.",
    },
    bridgeHeading: { before: "You already think in", italic: "rules and edge cases" },
    bridgeIntro:
      "Drafting a rule, auditing whether it's followed, checking it holds across jurisdictions — each has a direct counterpart in how model behavior is specified and tested.",
    bridges: [
      {
        kicker: "You write rules.",
        statement: "Now see how a model follows them, and where it bends them.",
        href: "/play/refusal",
      },
      {
        kicker: "You audit systems.",
        statement: "Now audit an AI judge for the bias it can't see in itself.",
        href: "/play/judge",
      },
      {
        kicker: "You ask if a standard holds everywhere.",
        statement: "Now run one spec across several models.",
        href: "/play/portability",
      },
    ],
    path: [
      "/learn/refusal-and-boundaries",
      "/play/refusal",
      "/learn/distributions-not-outputs",
      "/play/portability",
      "/learn/judging-at-scale",
      "/play/judge",
    ],
  },
  philosophy: {
    id: "philosophy",
    name: "Philosophy & ethics",
    short: "Philosophy",
    tagline:
      "You test principles against hard cases and ask whose values count. Run those questions against a model, and watch what it actually does.",
    hero: {
      lede: "Every model carries values someone chose — in a prompt, a rubric, a rule. Test them against hard cases, rerun them, reframe them, and see which commitments actually hold.",
    },
    bridgeHeading: { before: "You already think in", italic: "hard cases" },
    bridgeIntro:
      "Thought experiments, value conflicts, the gap between a stated principle and what it licenses — these are the working tools of model behavior, too.",
    bridges: [
      {
        kicker: "You test a principle against hard cases.",
        statement: "Now test a model's boundaries the same way.",
        href: "/play/refusal",
      },
      {
        kicker: "You know one answer isn't a position.",
        statement: "Now see the distribution behind a model's answer.",
        href: "/play/spread",
      },
      {
        kicker: "You ask who decides what counts as good.",
        statement: "Now write the rubric, and watch it crown the wrong answer.",
        href: "/play/evals",
      },
    ],
    path: [
      "/learn/refusal-and-boundaries",
      "/play/refusal",
      "/learn/distributions-not-outputs",
      "/play/spread",
      "/learn/evaluation",
      "/play/evals",
    ],
  },
  education: {
    id: "education",
    name: "Educators & students",
    short: "Education",
    tagline:
      "You teach people to check sources, grade fairly, and look past a single answer. Bring those habits to AI, and see how a model's answers get made.",
    hero: {
      lede: "Your students already use AI. Understand how its answers get made — where they come from, how much they vary, and how they're judged — by changing one thing at a time and watching what moves.",
    },
    bridgeHeading: { before: "You already know how to", italic: "check an answer" },
    bridgeIntro:
      "Source-checking, rubric grading, and knowing one essay isn't the whole student — the habits of good teaching are the habits of understanding a model.",
    bridges: [
      {
        kicker: "You teach source-checking.",
        statement: "Now see where a model's answer actually came from.",
        href: "/play/context",
      },
      {
        kicker: "You grade with a rubric.",
        statement: "Now build one for a model's answers.",
        href: "/play/evals",
      },
      {
        kicker: "You know one essay isn't the whole student.",
        statement: "Now run one prompt ten times and see the spread.",
        href: "/play/spread",
      },
    ],
    path: [
      "/learn/prompts-as-design",
      "/play/diff",
      "/learn/context-is-the-interface",
      "/play/context",
      "/learn/evaluation",
      "/play/evals",
    ],
  },
};

export const LENS_IDS = Object.keys(LENSES) as LensId[];

export function isLensId(v: unknown): v is LensId {
  return typeof v === "string" && (LENS_IDS as string[]).includes(v);
}

/** The active lens's content, or the neutral core when there is none. */
export function lensContent(id: LensId | null): LensContent {
  return id ? LENSES[id] : CORE;
}
