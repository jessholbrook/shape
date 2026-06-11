"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * True once the component is hydrated on the client; false on the server and
 * during the hydration render. The localStorage-backed hooks pair this with a
 * store value so consumers can hold layout until real data is in.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Bind a localStorage-backed value that announces writes via window events to
 * useSyncExternalStore. The snapshot is cached between events — getSnapshot
 * must be referentially stable or React re-renders forever — and invalidated
 * whenever one of the events fires.
 */
export function createLocalStore<T>({
  events,
  read,
  serverValue,
}: {
  events: string[];
  read: () => T;
  serverValue: T;
}): { useValue: () => T } {
  let snapshot: T;
  let initialized = false;

  function getSnapshot(): T {
    if (!initialized) {
      snapshot = read();
      initialized = true;
    }
    return snapshot;
  }

  function subscribe(onChange: () => void): () => void {
    const refresh = () => {
      initialized = false;
      onChange();
    };
    for (const e of events) window.addEventListener(e, refresh);
    return () => {
      for (const e of events) window.removeEventListener(e, refresh);
    };
  }

  return {
    useValue: () =>
      useSyncExternalStore(subscribe, getSnapshot, () => serverValue),
  };
}
