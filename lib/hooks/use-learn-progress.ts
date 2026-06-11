"use client";

import {
  LEARN_PROGRESS_EVENT,
  getReadSlugs,
} from "@/lib/learn-progress";
import { createLocalStore, useHydrated } from "./use-local-store";

const EMPTY: Set<string> = new Set();

const store = createLocalStore<Set<string>>({
  events: [LEARN_PROGRESS_EVENT, "storage"],
  read: getReadSlugs,
  serverValue: EMPTY,
});

export function useLearnProgress() {
  const read = store.useValue();
  const hydrated = useHydrated();

  function hasRead(slug: string): boolean {
    return read.has(slug);
  }

  return { read, hasRead, hydrated };
}
