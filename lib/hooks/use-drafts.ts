"use client";

import { useEffect, useState } from "react";
import { listDrafts, type Draft } from "../drafts";

export function useDrafts() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDrafts(listDrafts());
    setHydrated(true);
    const refresh = () => setDrafts(listDrafts());
    window.addEventListener("shape:drafts-changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shape:drafts-changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return { drafts, hydrated };
}
