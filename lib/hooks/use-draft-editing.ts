"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getDraft,
  saveDraft,
  type Draft,
  type DraftInput,
  type DraftKind,
} from "@/lib/drafts";
import type { DraftSaveStatus } from "@/components/play/draft-save-bar";

/** Fields the caller supplies — everything the persisted draft needs except the
 * stuff the saver tracks (id, kind, timestamps). */
export type DraftPayload<K extends DraftKind> = Omit<
  Extract<Draft, { kind: K }>,
  "id" | "kind" | "createdAt" | "updatedAt"
>;

/**
 * Combines draft hydration + the save-bar state machine + URL-keeping into one
 * hook. Replaces the ~40 lines of identical draftId/title/saveStatus/timer
 * plumbing that every playground and the studio used to inline.
 *
 * Usage:
 *
 *   const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
 *     initialDraftId,
 *     editorRoute: "/play/persona",
 *     kind: "persona",
 *     apply: (draft) => {
 *       setProvider(draft.provider);
 *       // ...
 *     },
 *   });
 *
 *   function handleSave() {
 *     save({ title: title.trim() || "Untitled", provider, model, ... });
 *   }
 *
 * On hydration (mount with `?draft=<id>` in the URL), the hook reads the draft,
 * invokes `apply` for the caller's local state, and seeds its own draftId/title
 * from the persisted snapshot. On save, it writes to localStorage, refreshes
 * draftId + title, flips status idle → saving → saved → idle (2s), and adds
 * `?draft=<id>` to the URL the first time a brand-new draft is persisted.
 */
export function useDraftEditing<K extends DraftKind>({
  initialDraftId,
  editorRoute,
  kind,
  apply,
}: {
  initialDraftId: string | null;
  /** Route to write to as `?draft=<id>` the first time a new draft persists. */
  editorRoute: string;
  /** Draft kind discriminator — gates which `apply` shape is allowed. */
  kind: K;
  /** Caller's per-surface state hydration from a persisted draft. */
  apply: (draft: Extract<Draft, { kind: K }>) => void;
}): {
  draftId: string | null;
  title: string;
  setTitle: (title: string) => void;
  saveStatus: DraftSaveStatus;
  save: (payload: DraftPayload<K>) => Draft;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [title, setTitleState] = useState("");
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef<string | null>(null);

  // Hydrate once per draftId. localStorage isn't readable during SSR, so we
  // can't seed via useState's lazy initializer (it would mismatch on the
  // client hydration pass). This effect runs once after mount and sets
  // several pieces of state in a row — the canonical "synchronize React with
  // an external store" exception to react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!initialDraftId || hydratedRef.current === initialDraftId) return;
    const d = getDraft(initialDraftId);
    if (d && d.kind === kind) {
      apply(d as Extract<Draft, { kind: K }>);
      /* eslint-disable react-hooks/set-state-in-effect */
      setDraftId(d.id);
      setTitleState(d.title);
      /* eslint-enable react-hooks/set-state-in-effect */
      hydratedRef.current = d.id;
    }
  }, [initialDraftId, kind, apply]);

  // Clean up the "Saved" pulse timer on unmount.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const setTitle = useCallback((next: string) => {
    setTitleState(next);
    // Editing the title moves us out of the "Saved" confirmation state, so the
    // next click on Save is meaningful.
    setSaveStatus((s) => (s === "saved" ? "idle" : s));
  }, []);

  const save = useCallback(
    (payload: DraftPayload<K>): Draft => {
      setSaveStatus("saving");
      const input = {
        ...(payload as object),
        kind,
        id: draftId ?? undefined,
      } as DraftInput;
      const saved = saveDraft(input);
      setDraftId(saved.id);
      setTitleState(saved.title);
      setSaveStatus("saved");
      if (!searchParams.get("draft")) {
        router.replace(`${editorRoute}?draft=${saved.id}`, { scroll: false });
      }
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      return saved;
    },
    [draftId, editorRoute, kind, router, searchParams],
  );

  return { draftId, title, setTitle, saveStatus, save };
}
