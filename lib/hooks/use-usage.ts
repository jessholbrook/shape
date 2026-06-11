"use client";

import { getTodaySummary, type UsageSummary } from "../usage";
import { createLocalStore, useHydrated } from "./use-local-store";

const EMPTY: UsageSummary = {
  totalCost: 0,
  totalTokens: 0,
  callCount: 0,
  byProvider: {},
};

const store = createLocalStore<UsageSummary>({
  events: ["shape:usage-changed", "storage"],
  read: getTodaySummary,
  serverValue: EMPTY,
});

export function useUsage() {
  const summary = store.useValue();
  const hydrated = useHydrated();
  return { summary, hydrated };
}
