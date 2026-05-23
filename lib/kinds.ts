import type { DraftKind } from "./drafts";

/**
 * Full-length artifact-page label. Used on per-artifact pages, profiles,
 * gallery cards — anywhere the artifact stands on its own and needs to
 * announce its kind.
 */
export const ARTIFACT_KIND_LABEL: Record<DraftKind, string> = {
  diff: "Diff Log",
  tone: "Behavior Spec",
  persona: "Persona Card",
  refusal: "Refusal Scorecard",
  evals: "Eval Scorecard",
  choreographer: "Conversation",
  "case-study": "Case Study",
};

/**
 * Short label for listing surfaces (Notebook rows, future search results)
 * where horizontal space is tight and the kind is just a tag.
 */
export const DRAFT_KIND_SHORT_LABEL: Record<DraftKind, string> = {
  diff: "Diff",
  tone: "Tone",
  persona: "Persona",
  refusal: "Refusal",
  evals: "Evals",
  choreographer: "Flow",
  "case-study": "Case Study",
};
