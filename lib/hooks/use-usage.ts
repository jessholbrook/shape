"use client";

import { useEffect, useState } from "react";
import { getTodaySummary, type UsageSummary } from "../usage";

const EMPTY: UsageSummary = {
  totalCost: 0,
  totalTokens: 0,
  callCount: 0,
  byProvider: {},
};

export function useUsage() {
  const [summary, setSummary] = useState<UsageSummary>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSummary(getTodaySummary());
    setHydrated(true);
    const refresh = () => setSummary(getTodaySummary());
    window.addEventListener("shape:usage-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shape:usage-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { summary, hydrated };
}
