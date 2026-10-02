"use client";

import { useCallback } from "react";
import { isLensId, type LensId } from "../lenses";
import { createLocalStore } from "./use-local-store";

const LENS_KEY = "shape:lens";
const LENS_EVENT = "shape:lens-changed";

function readLens(): LensId | null {
  try {
    const v = window.localStorage.getItem(LENS_KEY);
    return isLensId(v) ? v : null;
  } catch {
    return null;
  }
}

/** Persist the reader's lens; `null` returns them to the neutral core. */
export function writeLens(id: LensId | null) {
  try {
    if (id) window.localStorage.setItem(LENS_KEY, id);
    else window.localStorage.removeItem(LENS_KEY);
  } catch {
    /* storage blocked — the lens just won't persist */
  }
  window.dispatchEvent(new Event(LENS_EVENT));
}

const store = createLocalStore<LensId | null>({
  events: [LENS_EVENT, "storage"],
  read: readLens,
  serverValue: null,
});

/**
 * The reader's chosen lens, or null for the neutral core. Server render and
 * the hydration pass always see null, so lens-specific content swaps in just
 * after hydration rather than mismatching.
 */
export function useLens() {
  const lens = store.useValue();
  const setLens = useCallback((id: LensId | null) => writeLens(id), []);
  return { lens, setLens };
}
