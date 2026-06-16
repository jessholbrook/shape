"use client";

import {
  LEARN_PROGRESS_EVENT,
  getDismissedConceptLinks,
  getReadSlugs,
} from "@/lib/learn-progress";
import { createLocalStore, useHydrated } from "./use-local-store";

const EMPTY: Set<string> = new Set();

const readStore = createLocalStore<Set<string>>({
  events: [LEARN_PROGRESS_EVENT, "storage"],
  read: getReadSlugs,
  serverValue: EMPTY,
});

const dismissedStore = createLocalStore<Set<string>>({
  events: [LEARN_PROGRESS_EVENT, "storage"],
  read: getDismissedConceptLinks,
  serverValue: EMPTY,
});

export function useLearnProgress() {
  const read = readStore.useValue();
  const dismissed = dismissedStore.useValue();
  const hydrated = useHydrated();

  function hasRead(slug: string): boolean {
    return read.has(slug);
  }

  function isConceptLinkDismissed(slug: string): boolean {
    return dismissed.has(slug);
  }

  return { read, hasRead, isConceptLinkDismissed, hydrated };
}
