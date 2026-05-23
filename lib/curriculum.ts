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
    playground: { label: "Module 0 setup", href: "/start" },
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
      "Style is composable. Move warmth, verbosity, directness as independent dials.",
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
    playground: { label: "Persona Workshop", href: "/play/persona" },
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
      "Lists, headings, JSON, paragraphs. Format is part of voice; pick one on purpose.",
    artifact: "Structured-output spec",
    href: "/learn/output-formatting",
    status: "ready",
    readMinutes: 4,
  },
  {
    num: "06",
    slug: "evaluation",
    title: "Evaluation",
    kicker: "Concept",
    blurb:
      "Rubrics + sample sets. Score behavior the same way you score a usability study.",
    playground: { label: "Eval Workshop", href: "/play/evals" },
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
    slug: "putting-it-together",
    title: "Putting it together",
    kicker: "Studio",
    blurb:
      "End-to-end project. Brief → persona → tone → evals → case study.",
    artifact: "Case Study",
    href: "#",
    status: "soon",
    readMinutes: 10,
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
