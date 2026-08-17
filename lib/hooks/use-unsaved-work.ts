"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Tracks whether the current playground has generated output the user hasn't
 * saved. Module-level (not React state) because the Shell — which owns the nav
 * and the leave-toast — reads it at click time without re-rendering on every
 * keystroke.
 *
 * The guard is intentionally non-blocking: navigation is never intercepted, so
 * a user exploring is never interrupted or trapped. When they leave a
 * playground with unsaved output, we flag a gentle, auto-dismissing toast on
 * the destination page — a reminder, not a wall.
 */
let unsaved = false;

export function hasUnsavedWork(): boolean {
  return unsaved;
}

export function clearUnsavedWork(): void {
  unsaved = false;
}

// --- Leave toast -----------------------------------------------------------
// Bumped when the user navigates away from a playground that had unsaved
// output; the <UnsavedToast> on the page they land on syncs to this version
// via useSyncExternalStore (see useUnsavedLeaveToastVersion below) and shows
// itself whenever it changes. Module-level so it survives the Shell
// unmount/remount that happens during client navigation.

let toastVersion = 0;
const toastListeners = new Set<() => void>();

export function flagUnsavedLeaveToast(): void {
  toastVersion++;
  for (const l of toastListeners) l();
}

function getToastVersion(): number {
  return toastVersion;
}

function subscribeUnsavedLeaveToast(fn: () => void): () => void {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
}

/**
 * Syncs to the leave-toast version. Starts at 0 on both server and client —
 * a flag can only land after the app is interactive — and changes whenever
 * flagUnsavedLeaveToast fires, including one that landed before this hook's
 * first render (module state persists across the client-side route change).
 */
export function useUnsavedLeaveToastVersion(): number {
  return useSyncExternalStore(
    subscribeUnsavedLeaveToast,
    getToastVersion,
    () => 0,
  );
}

/**
 * Register whether this playground currently holds unsaved generated output.
 * Clears on unmount.
 */
export function useUnsavedWork(isDirty: boolean) {
  useEffect(() => {
    unsaved = isDirty;
  }, [isDirty]);

  useEffect(() => {
    return () => clearUnsavedWork();
  }, []);
}
