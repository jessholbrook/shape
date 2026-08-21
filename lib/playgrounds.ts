/**
 * The playground registry — the single source of truth for what exists under
 * /play, in the order the index lists them.
 *
 * It lives here rather than in the page component because two other places
 * need it: the sitemap (which used to carry a hand-kept copy of half these
 * routes) and the content-consistency test. A registry that only the page can
 * read is a registry that silently drifts from everything else.
 */
export type Playground = {
  num: string;
  href: string;
  title: string;
  italic: string;
  blurb: string;
  artifact: string;
  status: "ready" | "soon";
  /** The concept this playground teaches — used in the card footer line. */
  concept?: { href: string; label: string };
};

export const PLAYGROUNDS: Playground[] = [
  {
    num: "01",
    href: "/play/diff",
    title: "Diff",
    italic: "mode",
    blurb:
      "Run one prompt through two configurations side-by-side. The fastest way to feel how prompts shape outputs.",
    artifact: "Diff Log",
    status: "ready",
    concept: { href: "/learn/prompts-as-design", label: "Prompts as design" },
  },
  {
    num: "02",
    href: "/play/tone",
    title: "Tone",
    italic: "dial",
    blurb:
      "Treat style as a design token. Move dials for warmth, verbosity, energy, directness — see the prompt compose itself.",
    artifact: "Behavior Spec",
    status: "ready",
    concept: { href: "/learn/voice-and-tone", label: "Voice & tone" },
  },
  {
    num: "03",
    href: "/play/persona",
    title: "Persona",
    italic: "lab",
    blurb:
      "Design a character — backstory, beliefs, blind spots — and watch the model embody them.",
    artifact: "Persona Card",
    status: "ready",
    concept: { href: "/learn/personas-for-ai", label: "Personas for AI" },
  },
  {
    num: "04",
    href: "/play/refusal",
    title: "Refusal",
    italic: "lab",
    blurb:
      "Probe boundary design with a panel of edge cases. Tune the line between over- and under-refusal.",
    artifact: "Refusal Scorecard",
    status: "ready",
    concept: {
      href: "/learn/refusal-and-boundaries",
      label: "Refusal & boundaries",
    },
  },
  {
    num: "05",
    href: "/play/evals",
    title: "Eval",
    italic: "lab",
    blurb:
      "Rubric-based evaluation. Define what good looks like, score the model against it, watch the average move.",
    artifact: "Eval Rubric + Scorecard",
    status: "ready",
    concept: { href: "/learn/evaluation", label: "Evaluation" },
  },
  {
    num: "06",
    href: "/play/choreographer",
    title: "Conversation",
    italic: "choreographer",
    blurb:
      "Write the user's side of a conversation in advance, then run it. Same script, different system prompt — see how the model holds the thread.",
    artifact: "Behavior Spec",
    status: "ready",
    concept: { href: "/learn/multi-turn-flows", label: "Multi-turn flows" },
  },
  {
    num: "07",
    href: "/play/spread",
    title: "Spread",
    italic: "lab",
    blurb:
      "Run one config many times. Outputs are a distribution, not a value — find out which clauses of your spec actually hold.",
    artifact: "Stability Report",
    status: "ready",
    concept: {
      href: "/learn/distributions-not-outputs",
      label: "Distributions, not outputs",
    },
  },
  {
    num: "08",
    href: "/play/race",
    title: "Race",
    italic: "lab",
    blurb:
      "One prompt, two models, at once. Watch what the better answer actually costs — in seconds and in dollars.",
    artifact: "Speed Trial",
    status: "ready",
  },
  {
    num: "09",
    href: "/play/portability",
    title: "Portability",
    italic: "lab",
    blurb:
      "One spec, several models. Find out which clauses are real rules and which are incantations tuned to a single vendor.",
    artifact: "Portability Report",
    status: "ready",
    concept: {
      href: "/learn/distributions-not-outputs",
      label: "Distributions, not outputs",
    },
  },
  {
    num: "10",
    href: "/play/context",
    title: "Context",
    italic: "lab",
    blurb:
      "One question, several context sets. Your system prompt is a fraction of what the model reads — see the rest, and where the answer came from.",
    artifact: "Context Map",
    status: "ready",
    concept: {
      href: "/learn/context-is-the-interface",
      label: "Context is the interface",
    },
  },
  {
    num: "11",
    href: "/play/tools",
    title: "Tool",
    italic: "bench",
    blurb:
      "Now it does things, not just says things. Write the tools and the policy, then find out where it draws the line between asking and acting.",
    artifact: "Agency Policy",
    status: "ready",
    concept: { href: "/learn/designing-agency", label: "Designing agency" },
  },
  {
    num: "12",
    href: "/play/judge",
    title: "Judge",
    italic: "lab",
    blurb:
      "Hand the scoring to a model, then check it. Every comparison runs twice with the answers swapped — a judge reading position gives itself away.",
    artifact: "Calibrated Judge",
    status: "ready",
    concept: { href: "/learn/judging-at-scale", label: "Judging at scale" },
  },
];
