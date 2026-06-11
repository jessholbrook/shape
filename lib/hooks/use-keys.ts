"use client";

import { useCallback } from "react";
import { ProviderId, PROVIDER_LIST } from "../providers";
import { getKey, setKey as writeKey, clearKey as removeKey } from "../keys";
import { createLocalStore, useHydrated } from "./use-local-store";

export type KeyMap = Partial<Record<ProviderId, string>>;

function readAll(): KeyMap {
  const out: KeyMap = {};
  for (const p of PROVIDER_LIST) {
    const v = getKey(p.id);
    if (v) out[p.id] = v;
  }
  return out;
}

const store = createLocalStore<KeyMap>({
  events: ["shape:keys-changed", "storage"],
  read: readAll,
  serverValue: {},
});

export function useKeys() {
  const keys = store.useValue();
  const hydrated = useHydrated();

  const saveKey = useCallback((providerId: ProviderId, key: string) => {
    writeKey(providerId, key.trim());
  }, []);

  const clearKey = useCallback((providerId: ProviderId) => {
    removeKey(providerId);
  }, []);

  const hasAnyKey = hydrated && Object.values(keys).some(Boolean);

  return { keys, hydrated, hasAnyKey, saveKey, clearKey };
}
