"use client";

import { useEffect, useState } from "react";

/** Is sharing switched on? Asked once per page load; null until known. */
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;

function load(): Promise<boolean> {
  inflight ??= fetch("/api/share", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .then((s: { enabled?: boolean }) => (cached = !!s.enabled))
    .catch(() => (cached = false));
  return inflight;
}

export function useShareStatus(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(cached);
  useEffect(() => {
    let live = true;
    void load().then((v) => live && setEnabled(v));
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
