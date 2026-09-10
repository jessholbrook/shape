"use client";

import { useCallback } from "react";
import {
  CUSTOM_ENDPOINT_EVENT,
  clearCustomEndpoint,
  getCustomEndpoint,
  setCustomEndpoint,
  type CustomEndpoint,
} from "../custom-endpoint";
import { createLocalStore, useHydrated } from "./use-local-store";

const store = createLocalStore<CustomEndpoint | null>({
  events: [CUSTOM_ENDPOINT_EVENT, "storage"],
  read: getCustomEndpoint,
  serverValue: null,
});

export function useCustomEndpoint() {
  const endpoint = store.useValue();
  const hydrated = useHydrated();
  const save = useCallback(
    (baseUrl: string, keyless = false) => setCustomEndpoint(baseUrl, { keyless }),
    [],
  );
  const clear = useCallback(() => clearCustomEndpoint(), []);
  return { endpoint, hydrated, save, clear };
}
