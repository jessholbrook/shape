"use client";

import { useEffect, useState } from "react";
import {
  LEARN_PROGRESS_EVENT,
  getReadSlugs,
} from "@/lib/learn-progress";

export function useLearnProgress() {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRead(getReadSlugs());
    setHydrated(true);
    const refresh = () => setRead(getReadSlugs());
    window.addEventListener(LEARN_PROGRESS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(LEARN_PROGRESS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  function hasRead(slug: string): boolean {
    return read.has(slug);
  }

  return { read, hasRead, hydrated };
}
