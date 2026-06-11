"use client";

import { listDrafts, type Draft } from "../drafts";
import { createLocalStore, useHydrated } from "./use-local-store";

const store = createLocalStore<Draft[]>({
  events: ["shape:drafts-changed", "storage"],
  read: listDrafts,
  serverValue: [],
});

export function useDrafts() {
  const drafts = store.useValue();
  const hydrated = useHydrated();
  return { drafts, hydrated };
}
