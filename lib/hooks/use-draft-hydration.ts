"use client";

import { useEffect, useRef } from "react";
import { getDraft, type Draft, type DraftKind } from "@/lib/drafts";

/**
 * One-shot draft hydration for playground and studio client components.
 *
 * The pattern these surfaces share: read `?draft=<id>` from the URL on mount,
 * fetch the draft from localStorage, seed local state with its fields. We
 * can't seed via useState's lazy initializer because localStorage isn't
 * readable during SSR (the initial state would mismatch on client hydration).
 * Doing it inline with several setState calls in a useEffect trips
 * `react-hooks/set-state-in-effect`; centralizing the pattern here keeps each
 * playground's hydration small and avoids spreading per-file lint disables.
 *
 * Pass an `apply` callback that does whatever local setStates the surface
 * needs. The hook guarantees it's called at most once per `draftId`.
 */
export function useDraftHydration<K extends DraftKind>(
  draftId: string | null,
  kind: K,
  apply: (draft: Extract<Draft, { kind: K }>) => void,
): void {
  const hydratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draftId || hydratedRef.current === draftId) return;
    const d = getDraft(draftId);
    if (d && d.kind === kind) {
      apply(d as Extract<Draft, { kind: K }>);
      hydratedRef.current = d.id;
    }
  }, [draftId, kind, apply]);
}
