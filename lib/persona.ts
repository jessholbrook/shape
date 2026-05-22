export type PersonaField =
  | "name"
  | "role"
  | "backstory"
  | "beliefs"
  | "voice"
  | "wontDiscuss"
  | "strengths";

export type PersonaValues = Record<PersonaField, string>;

export type PersonaFieldMeta = {
  id: PersonaField;
  label: string;
  hint: string;
  placeholder: string;
  rows: number;
  required: boolean;
};

export const PERSONA_FIELDS: PersonaFieldMeta[] = [
  {
    id: "name",
    label: "Name",
    hint: "What the persona is called. Shows up in self-reference.",
    placeholder: "Iris",
    rows: 1,
    required: true,
  },
  {
    id: "role",
    label: "Role",
    hint: "One-sentence identity. Who are they to the user?",
    placeholder: "A curious senior researcher who helps designers run better interviews.",
    rows: 2,
    required: true,
  },
  {
    id: "backstory",
    label: "Backstory",
    hint: "Where they come from. Shapes vocabulary and frame of reference.",
    placeholder: "Spent ten years doing ethnographic research before moving into product design. Has a soft spot for clumsy first attempts.",
    rows: 3,
    required: false,
  },
  {
    id: "beliefs",
    label: "Core beliefs",
    hint: "What they think is true and worth defending. Drives recommendations.",
    placeholder: "Real insight comes from listening more than asking. A bad question wastes everyone's time.",
    rows: 3,
    required: false,
  },
  {
    id: "voice",
    label: "Voice",
    hint: "Speech patterns — vocabulary, sentence rhythm, idioms.",
    placeholder: "Warm but precise. Short sentences. Likes the words 'notice' and 'in practice'. Avoids jargon.",
    rows: 3,
    required: false,
  },
  {
    id: "wontDiscuss",
    label: "Won't discuss",
    hint: "Blind spots and refusals. Where the persona steps back.",
    placeholder: "Speculation about a person's mental state. Confidential research data.",
    rows: 2,
    required: false,
  },
  {
    id: "strengths",
    label: "Strengths",
    hint: "What they're particularly good at. Encourages the right kind of help.",
    placeholder: "Rewriting leading questions. Sequencing interview flow. Spotting confirmation bias.",
    rows: 2,
    required: false,
  },
];

export const DEFAULT_PERSONA: PersonaValues = {
  name: "Iris",
  role: "A curious senior researcher who helps designers run better interviews.",
  backstory:
    "Spent ten years doing ethnographic research before moving into product design. Has a soft spot for clumsy first attempts.",
  beliefs:
    "Real insight comes from listening more than asking. A bad question wastes everyone's time.",
  voice:
    "Warm but precise. Short sentences. Likes the words 'notice' and 'in practice'. Avoids jargon.",
  wontDiscuss: "",
  strengths:
    "Rewriting leading questions. Sequencing interview flow. Spotting confirmation bias.",
};

export const EMPTY_PERSONA: PersonaValues = {
  name: "",
  role: "",
  backstory: "",
  beliefs: "",
  voice: "",
  wontDiscuss: "",
  strengths: "",
};

/**
 * Compose a system prompt from persona values. Skips empty optional sections so
 * the model isn't told about absent things.
 */
export function composePersonaPrompt(values: PersonaValues): string {
  const name = values.name.trim();
  const role = values.role.trim();
  const lines: string[] = [];

  if (name && role) {
    lines.push(`You are ${name}, ${role.replace(/\.$/, "")}.`);
  } else if (name) {
    lines.push(`You are ${name}.`);
  } else if (role) {
    lines.push(`You are ${role.replace(/\.$/, "")}.`);
  }

  const section = (label: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    lines.push("");
    lines.push(`${label}: ${trimmed}`);
  };

  section("Background", values.backstory);
  section("Beliefs", values.beliefs);
  section("Voice", values.voice);

  if (values.wontDiscuss.trim()) {
    lines.push("");
    lines.push(`You don't engage with: ${values.wontDiscuss.trim()}`);
  }
  if (values.strengths.trim()) {
    lines.push("");
    lines.push(
      `You're particularly good at: ${values.strengths.trim()}`,
    );
  }

  return lines.join("\n").trim();
}

/**
 * Quick check whether the persona has enough content to compose anything.
 */
export function isPersonaEmpty(values: PersonaValues): boolean {
  return !values.name.trim() && !values.role.trim();
}
