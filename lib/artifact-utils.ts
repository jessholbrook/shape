import type { Draft } from "./drafts";

export const ARTIFACTS_EVENT = "shape:artifacts-changed";

export function summarizeDraft(draft: Draft): string {
  switch (draft.kind) {
    case "diff": {
      const turns = draft.turns.length;
      const last = draft.turns[draft.turns.length - 1]?.userMessage ?? "";
      const tail = last
        ? ` — "${last.slice(0, 80)}${last.length > 80 ? "…" : ""}"`
        : "";
      return `${turns} ${turns === 1 ? "turn" : "turns"}${tail}`;
    }
    case "tone":
      return draft.brief.slice(0, 140) + (draft.brief.length > 140 ? "…" : "");
    case "persona": {
      const { name, role } = draft.persona;
      return [name, role].filter(Boolean).join(" — ");
    }
    case "refusal":
      return `${draft.probes.length} probe panel`;
    case "evals":
      return `${draft.cases.length} cases × ${draft.rubric.length} criteria`;
    case "choreographer":
      return `${draft.turns.length}-turn flow`;
    case "case-study": {
      const head = draft.brief.replace(/\s+/g, " ").trim();
      return head.length > 140 ? head.slice(0, 137) + "…" : head;
    }
    default:
      return "";
  }
}

/** Suggest a URL-safe slug from a title. */
export function slugForTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
