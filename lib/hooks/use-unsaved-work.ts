"use client";

import { useEffect } from "react";

/**
 * Tracks whether the current playground has generated output the user hasn't
 * saved. A module-level flag (not React state) because the Shell — which owns
 * the nav and the click guard — needs to read it at click time without
 * re-rendering on every keystroke. Playgrounds register their dirty state via
 * useUnsavedWork(); the Shell reads hasUnsavedWork() to decide whether to
 * confirm before navigating away.
 */
let unsaved = false;

export function hasUnsavedWork(): boolean {
  return unsaved;
}

export function clearUnsavedWork(): void {
  unsaved = false;
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  // Arms the browser's native "Leave site?" prompt for refresh / tab-close /
  // external navigation. Only attached while there's unsaved output.
  e.preventDefault();
  e.returnValue = "";
}

/**
 * Register whether this playground currently holds unsaved generated output.
 * Sets the global flag the Shell reads before in-app navigation, and arms a
 * native beforeunload prompt for hard exits. Clears the flag on unmount.
 */
export function useUnsavedWork(isDirty: boolean) {
  useEffect(() => {
    unsaved = isDirty;
    if (!isDirty) return;
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    return () => {
      unsaved = false;
    };
  }, []);
}
