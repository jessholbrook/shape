"use client";

import { useEffect } from "react";

/**
 * Tracks whether the current playground has generated output the user hasn't
 * saved, plus whether we've already warned them about it once. Module-level
 * (not React state) because the Shell — which owns the nav and the click
 * guard — reads these at click time without re-rendering on every keystroke.
 *
 * The guard is intentionally gentle: it warns once per unsaved session and
 * then gets out of the way, so a user is never trapped on the page.
 */
let unsaved = false;
let warned = false;

export function hasUnsavedWork(): boolean {
  return unsaved;
}

export function hasWarnedAboutUnsaved(): boolean {
  return warned;
}

export function markWarnedAboutUnsaved(): void {
  warned = true;
}

export function clearUnsavedWork(): void {
  unsaved = false;
  warned = false;
}

/**
 * Register whether this playground currently holds unsaved generated output.
 * Saving or clearing (isDirty → false) also resets the one-time warning, so a
 * fresh batch of work earns a fresh heads-up. Clears on unmount.
 */
export function useUnsavedWork(isDirty: boolean) {
  useEffect(() => {
    if (isDirty) {
      unsaved = true;
    } else {
      clearUnsavedWork();
    }
  }, [isDirty]);

  useEffect(() => {
    return () => clearUnsavedWork();
  }, []);
}
