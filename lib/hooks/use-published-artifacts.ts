"use client";

import { useEffect, useState } from "react";
import {
  ARTIFACTS_EVENT,
  getArtifactBackend,
  type Artifact,
} from "@/lib/artifacts";
import { getHandle } from "@/lib/handle";

/**
 * Reactive list of the current handle's public artifacts. Refreshes when the
 * publish backend dispatches ARTIFACTS_EVENT (e.g. after publish / unpublish).
 * Returns `byDraftId` keyed on `artifact.draft.id` so per-draft "already
 * published" lookups stay O(1).
 */
export function usePublishedArtifacts() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const handle = getHandle();
      if (!handle) {
        if (!cancelled) {
          setArtifacts([]);
          setHydrated(true);
        }
        return;
      }
      const backend = getArtifactBackend();
      const list = await backend.listByHandle(handle);
      if (!cancelled) {
        setArtifacts(list);
        setHydrated(true);
      }
    }
    load();
    const refresh = () => load();
    window.addEventListener(ARTIFACTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ARTIFACTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const byDraftId = new Map<string, Artifact>();
  for (const a of artifacts) byDraftId.set(a.draft.id, a);

  return { artifacts, byDraftId, hydrated };
}
