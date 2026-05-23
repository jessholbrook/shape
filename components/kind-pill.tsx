import type { DraftKind } from "@/lib/drafts";
import { ARTIFACT_KIND_LABEL, DRAFT_KIND_SHORT_LABEL } from "@/lib/kinds";

/**
 * The vermillion-on-soft pill that announces an artifact or draft kind.
 *
 * `variant="long"` (default) uses the full label — "Behavior Spec", "Persona
 * Card", etc. — for artifact pages and gallery cards. `variant="short"` uses
 * the terser tag — "Tone", "Persona" — for dense listings like the Notebook.
 */
export function KindPill({
  kind,
  variant = "long",
}: {
  kind: DraftKind;
  variant?: "long" | "short";
}) {
  const label =
    variant === "short" ? DRAFT_KIND_SHORT_LABEL[kind] : ARTIFACT_KIND_LABEL[kind];
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink bg-highlight-soft rounded-full px-2 py-0.5">
      {label}
    </span>
  );
}
