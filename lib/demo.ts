import type { Draft } from "./drafts";
import { composePersonaPrompt } from "./persona";
import { composeSystemPrompt, composeToneBlock } from "./tone";

/** Cheap, fast model for visitor demos. Regardless of what the author used. */
export const DEMO_MODEL = "claude-haiku-4-5";

/** Generous enough for a single coaching response, capped to keep costs predictable. */
export const DEMO_MAX_TOKENS = 512;

/** Default rate limits. Override via env if you need to. */
export const DEMO_DEFAULT_TURNS_PER_ARTIFACT_PER_DAY = 5;
export const DEMO_DEFAULT_TURNS_PER_IP_PER_DAY = 50;

/** Which artifact kinds expose a single system prompt to demo against. */
export type DemoableKind =
  | "persona"
  | "tone"
  | "choreographer"
  | "case-study";

export function isDemoableKind(kind: Draft["kind"]): kind is DemoableKind {
  return (
    kind === "persona" ||
    kind === "tone" ||
    kind === "choreographer" ||
    kind === "case-study"
  );
}

/**
 * The system prompt the demo backend will send to the model when a visitor
 * interacts with this artifact. Returns null for kinds where there's no single
 * configuration to demo (diff, refusal, evals).
 */
export function getDemoSystem(draft: Draft): string | null {
  switch (draft.kind) {
    case "persona":
      return composePersonaPrompt(draft.persona);
    case "tone":
      return composeSystemPrompt(draft.brief, draft.tone);
    case "choreographer":
      return draft.systemPrompt;
    case "case-study": {
      const personaPart = composePersonaPrompt(draft.persona);
      const tonePart = composeToneBlock(draft.tone);
      return [personaPart, tonePart].filter(Boolean).join("\n\n");
    }
    default:
      return null;
  }
}
