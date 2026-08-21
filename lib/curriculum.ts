export type ModuleStatus = "ready" | "soon";

export type CurriculumModule = {
  num: string;
  slug: string;
  title: string;
  italic?: string;
  kicker: string;
  blurb: string;
  playground?: { label: string; href: string };
  artifact: string;
  /**
   * SEO description for the module's page. Defaults to `blurb` — set it only
   * where card copy and a standalone search-result line genuinely want
   * different sentences.
   */
  description?: string;
  /** Internal target — /learn/<slug> for ready modules, "#" otherwise. */
  href: string;
  status: ModuleStatus;
  readMinutes?: number;
};

export const MODULES: CurriculumModule[] = [
  {
    num: "00",
    slug: "start",
    title: "Get your key",
    kicker: "Setup",
    blurb:
      "Bring your own model access. Five minutes to set up, then every playground is yours.",
    playground: { label: "Setup", href: "/start" },
    artifact: "First successful call",
    href: "/start",
    status: "ready",
    readMinutes: 5,
  },
  {
    num: "01",
    slug: "prompts-as-design",
    title: "Prompts",
    italic: "as design",
    kicker: "Concept",
    blurb:
      "A prompt is a design variable. Treat it like a brand-voice swatch, not a magic spell.",
    playground: { label: "Diff Mode", href: "/play/diff" },
    artifact: "Diff Log",
    href: "/learn/prompts-as-design",
    status: "ready",
    readMinutes: 6,
  },
  {
    num: "02",
    slug: "voice-and-tone",
    title: "Voice",
    italic: "& tone",
    kicker: "Concept",
    blurb:
      "Style is composable. Move warmth, verbosity, energy, directness as independent dials.",
    playground: { label: "Tone Dial", href: "/play/tone" },
    artifact: "Behavior Spec",
    href: "/learn/voice-and-tone",
    status: "ready",
    readMinutes: 5,
  },
  {
    num: "03",
    slug: "personas-for-ai",
    title: "Personas",
    italic: "for AI",
    kicker: "Concept",
    blurb:
      "Character design isn't decoration. Backstory, beliefs, and blind spots shape every response.",
    playground: { label: "Persona Lab", href: "/play/persona" },
    artifact: "Persona Card",
    href: "/learn/personas-for-ai",
    status: "ready",
    readMinutes: 7,
  },
  {
    num: "04",
    slug: "refusal-and-boundaries",
    title: "Refusal",
    italic: "& boundaries",
    kicker: "Concept",
    blurb:
      "Where the model says no is a design surface. Over- and under-refusal both fail users.",
    playground: { label: "Refusal Lab", href: "/play/refusal" },
    artifact: "Refusal Scorecard",
    href: "/learn/refusal-and-boundaries",
    status: "ready",
    readMinutes: 6,
  },
  {
    num: "05",
    slug: "output-formatting",
    title: "Output",
    italic: "formatting",
    kicker: "Concept",
    blurb:
      "Lists, headings, JSON, paragraphs. Formatting is part of voice; pick one on purpose.",
    // Note: /play/tone's primary module is voice-and-tone (02); the reverse
    // lookup in getModuleByPlaygroundHref returns the first match, so this
    // entry doesn't change the Tone Dial's concept link.
    playground: { label: "Tone Dial — Structure dial", href: "/play/tone" },
    artifact: "Structured-output spec",
    href: "/learn/output-formatting",
    status: "ready",
    readMinutes: 4,
  },
  {
    num: "06",
    slug: "evaluation",
    title: "",
    italic: "Evaluation",
    kicker: "Concept",
    blurb:
      "Rubrics + sample sets. Score behavior the same way you score a usability study.",
    description:
      "A rubric turns “good” from a feeling into a spec. Define what good looks like, then score against it.",
    playground: { label: "Eval Lab", href: "/play/evals" },
    artifact: "Eval Rubric + Scorecard",
    href: "/learn/evaluation",
    status: "ready",
    readMinutes: 8,
  },
  {
    num: "07",
    slug: "multi-turn-flows",
    title: "Multi-turn",
    italic: "flows",
    kicker: "Concept",
    blurb:
      "Conversations have shape. Choreograph turns the way you'd choreograph an onboarding.",
    playground: { label: "Conversation Choreographer", href: "/play/choreographer" },
    artifact: "Behavior Spec",
    href: "/learn/multi-turn-flows",
    status: "ready",
    readMinutes: 6,
  },
  {
    num: "08",
    slug: "distributions-not-outputs",
    title: "Distributions,",
    italic: "not outputs",
    kicker: "Concept",
    blurb:
      "One output is a sample, not a result. Design against the spread — and find out which clauses of your spec actually hold.",
    playground: { label: "Spread", href: "/play/spread" },
    artifact: "Stability Report",
    href: "/learn/distributions-not-outputs",
    status: "ready",
    readMinutes: 6,
  },
  {
    num: "09",
    slug: "context-is-the-interface",
    title: "Context is the",
    italic: "interface",
    kicker: "Concept",
    blurb:
      "Your system prompt is a fraction of what the model reads. The rest arrives at runtime, from systems nobody designed.",
    playground: { label: "Context Lab", href: "/play/context" },
    artifact: "Context Map",
    href: "/learn/context-is-the-interface",
    status: "ready",
    readMinutes: 7,
  },
  {
    num: "10",
    slug: "designing-agency",
    title: "Designing",
    italic: "agency",
    kicker: "Concept",
    blurb:
      "Now it does things, not just says them. Where the line sits between acting and asking — and why a policy sentence isn't enough.",
    playground: { label: "Tool Bench", href: "/play/tools" },
    artifact: "Agency Policy",
    href: "/learn/designing-agency",
    status: "ready",
    readMinutes: 7,
  },
  {
    num: "11",
    slug: "judging-at-scale",
    title: "Judging",
    italic: "at scale",
    kicker: "Concept",
    blurb:
      "Hand the scoring to a model and you inherit its biases. Counterbalance it the way you'd counterbalance a study.",
    playground: { label: "Judge Lab", href: "/play/judge" },
    artifact: "Calibrated Judge",
    href: "/learn/judging-at-scale",
    status: "ready",
    readMinutes: 7,
  },
];

export function getModule(slug: string): CurriculumModule | undefined {
  return MODULES.find((m) => m.slug === slug);
}

export function nextModule(slug: string): CurriculumModule | undefined {
  const i = MODULES.findIndex((m) => m.slug === slug);
  if (i === -1 || i === MODULES.length - 1) return undefined;
  return MODULES[i + 1];
}

/**
 * Reverse lookup — find the module paired with a given playground href, so a
 * playground page can resolve its concept article without hardcoding the slug.
 */
export function getModuleByPlaygroundHref(
  href: string,
): CurriculumModule | undefined {
  return MODULES.find((m) => m.playground?.href === href);
}

/** Display title — the card splits it for italics; everywhere else wants it whole. */
export function moduleTitle(mod: CurriculumModule): string {
  return [mod.title, mod.italic].filter(Boolean).join(" ").trim();
}

/**
 * Page metadata for a lesson, derived from its curriculum entry.
 *
 * Every lesson page used to declare its own `title` and `description` by hand,
 * which meant each copy edit had to be made in two files. It reliably wasn't:
 * three of eleven had drifted from their curriculum entry by the time this was
 * written. Deriving them removes the failure mode rather than policing it.
 */
export function moduleMetadata(slug: string): {
  title: string;
  description: string;
} {
  const mod = getModule(slug);
  if (!mod) throw new Error(`No curriculum module for slug "${slug}"`);
  return {
    title: moduleTitle(mod),
    description: mod.description ?? mod.blurb,
  };
}
