"use client";

import { useEffect } from "react";

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
// Set when the user navigates away from a playground that had unsaved output;
// consumed by the <UnsavedToast> on the page they land on. Module-level so it
// survives the Shell unmount/remount that happens during client navigation.

let pendingToast = false;
const toastListeners = new Set<() => void>();

export function flagUnsavedLeaveToast(): void {
  pendingToast = true;
  for (const l of toastListeners) l();
}

export function consumeUnsavedLeaveToast(): boolean {
  const had = pendingToast;
  pendingToast = false;
  return had;
}

export function subscribeUnsavedLeaveToast(fn: () => void): () => void {
  toastListeners.add(fn);
  return () => toastListeners.delete(fn);
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
