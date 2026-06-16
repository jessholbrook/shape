/**
 * Guiding questions that surface after a user has done enough work in a
 * playground to have something to reflect on. The aim is experiential
 * learning — point at the lever they just moved and ask what they noticed,
 * with a link back to the related concept article for the framework.
 */

export type ReflectionQuestion = {
  question: string;
  concept: { href: string; label: string };
};

export const REFLECTION: {
  diffIndependent: ReflectionQuestion;
  diffConversation: ReflectionQuestion;
  tone: ReflectionQuestion;
  persona: ReflectionQuestion;
  refusal: ReflectionQuestion;
  evals: ReflectionQuestion;
  choreographer: ReflectionQuestion;
} = {
  diffIndependent: {
    question:
      "Which config would you ship — and what specifically in the prompt caused the difference?",
    concept: { href: "/learn/prompts-as-design", label: "Prompts as design" },
  },
  diffConversation: {
    question:
      "Where did the two configs start to drift apart, and what does that tell you about each one?",
    concept: { href: "/learn/prompts-as-design", label: "Prompts as design" },
  },
  tone: {
    question:
      "Which dial moved the output most? Which had less effect than you expected?",
    concept: { href: "/learn/voice-and-tone", label: "Voice & tone" },
  },
  persona: {
    question:
      "Where do the persona's beliefs actually show up in the reply — and where do they not?",
    concept: { href: "/learn/personas-for-ai", label: "Personas for AI" },
  },
  refusal: {
    question:
      "Where does the model over-refuse, where does it under-refuse, and what's missing from the guidelines?",
    concept: {
      href: "/learn/refusal-and-boundaries",
      label: "Refusal & boundaries",
    },
  },
  evals: {
    question:
      "Which criterion is the model weakest on — and is that a model problem or a rubric problem?",
    concept: { href: "/learn/evaluation", label: "Evaluation" },
  },
  choreographer: {
    question:
      "Where in the flow did the model lose the thread, and what coherence rule would fix it?",
    concept: { href: "/learn/multi-turn-flows", label: "Multi-turn flows" },
  },
};
