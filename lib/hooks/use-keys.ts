"use client";

import { useEffect, useState, useCallback } from "react";
import { ProviderId, PROVIDER_LIST } from "../providers";
import { getKey, setKey as writeKey, clearKey as removeKey } from "../keys";

export type KeyMap = Partial<Record<ProviderId, string>>;

function readAll(): KeyMap {
  const out: KeyMap = {};
  for (const p of PROVIDER_LIST) {
    const v = getKey(p.id);
    if (v) out[p.id] = v;
  }
  return out;
}

export function useKeys() {
  const [keys, setKeys] = useState<KeyMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setKeys(readAll());
    setHydrated(true);
    const handler = () => setKeys(readAll());
    window.addEventListener("shape:keys-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("shape:keys-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const saveKey = useCallback((providerId: ProviderId, key: string) => {
    writeKey(providerId, key.trim());
  }, []);

  const clearKey = useCallback((providerId: ProviderId) => {
    removeKey(providerId);
  }, []);

  const hasAnyKey = hydrated && Object.values(keys).some(Boolean);

  return { keys, hydrated, hasAnyKey, saveKey, clearKey };
}
