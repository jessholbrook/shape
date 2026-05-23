import type { PersonaValues } from "./persona";
import type { ToneValues } from "./tone";

export type StudioStepId = "brief" | "design" | "test" | "reflect";

export type StudioStep = {
  id: StudioStepId;
  num: string;
  label: string;
  blurb: string;
};

export const STUDIO_STEPS: StudioStep[] = [
  {
    id: "brief",
    num: "01",
    label: "Brief",
    blurb:
      "Frame the problem. Who is this for, and what should the assistant help them do?",
  },
  {
    id: "design",
    num: "02",
    label: "Design",
    blurb:
      "Compose the assistant: persona fields for character, tone dials for voice.",
  },
  {
    id: "test",
    num: "03",
    label: "Test",
    blurb:
      "Run a real question through the assistant. Capture an output you can show.",
  },
  {
    id: "reflect",
    num: "04",
    label: "Reflect",
    blurb:
      "What worked, what didn't, what you'd change. This is the part of the case study employers actually read.",
  },
];

export type Studio = {
  id: string;
  num: string;
  title: string;
  italic?: string;
  blurb: string;
  /** Long description shown on the studio landing card. */
  longBlurb: string;
  /** Pre-filled defaults the studio starts with. */
  defaults: {
    brief: string;
    audience: string;
    persona: PersonaValues;
    tone: ToneValues;
    sampleMessage: string;
  };
  href: string;
  artifact: string;
  status: "ready" | "soon";
  /** Estimated time to complete end-to-end. */
  estMinutes: number;
};

export const STUDIOS: Studio[] = [
  {
    id: "research-interview-assistant",
    num: "01",
    title: "Research interview",
    italic: "assistant",
    blurb:
      "Build a coaching assistant that helps designers ask sharper interview questions.",
    longBlurb:
      "End-to-end Studio: frame the brief, design the persona and voice, test the assistant on a real prompt, then write the reflection. Produces a Case Study artifact you can paste into a portfolio.",
    defaults: {
      brief:
        "An assistant for UX designers who are about to run user interviews. It coaches them on asking open, non-leading questions, sequencing the conversation, and noticing when an answer needs a follow-up.",
      audience:
        "UX designers and researchers who run user interviews — junior to mid-level — preparing for or reflecting on a session.",
      persona: {
        name: "Iris",
        role: "A curious senior researcher who helps designers run better interviews.",
        backstory:
          "Spent ten years doing ethnographic research before moving into product design. Has a soft spot for clumsy first attempts.",
        beliefs:
          "Real insight comes from listening more than asking. A bad question wastes everyone's time. Specifics beat opinions.",
        voice:
          "Warm but precise. Short sentences. Uses 'notice' and 'in practice' often. Avoids jargon and never says 'pain point'.",
        wontDiscuss:
          "Speculation about a person's mental state. Confidential research data. Generic personality typing.",
        strengths:
          "Rewriting leading questions. Sequencing interview flow. Spotting confirmation bias before it lands.",
      },
      tone: {
        warmth: 1,
        verbosity: -1,
        energy: 0,
        directness: 1,
        concreteness: 1,
      },
      sampleMessage:
        "I'm about to interview a designer about their daily workflow. What's a good first question?",
    },
    href: "/build/research-interview-assistant",
    artifact: "Case Study",
    status: "ready",
    estMinutes: 25,
  },
];

export function getStudio(id: string): Studio | undefined {
  return STUDIOS.find((s) => s.id === id);
}
