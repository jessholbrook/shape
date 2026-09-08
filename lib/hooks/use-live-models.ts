"use client";

import { useCallback, useEffect, useMemo } from "react";
import {
  PROVIDERS,
  providerNeedsKey,
  type ModelMeta,
  type ProviderId,
} from "../providers";
import {
  LIVE_MODELS_EVENT,
  getLiveCache,
  getLiveStatus,
  isFresh,
  mergeModels,
  refreshLiveModels,
  supportsLiveModels,
} from "../live-models";
import { createLocalStore } from "./use-local-store";
import { useKeys } from "./use-keys";
import { useCustomEndpoint } from "./use-custom-endpoint";

const store = createLocalStore({
  events: [LIVE_MODELS_EVENT],
  read: () => ({ cache: { ...getLiveCache() }, status: { ...getLiveStatus() } }),
  serverValue: { cache: {}, status: {} },
});

export type LiveStatus = "static" | "loading" | "live" | "error";

/**
 * The model list a picker should show for a provider: the static catalog
 * until the API has answered, the merged list after. Fetches once per
 * provider per session when a key is present, and again on `refresh`.
 *
 * Loading and error state live in the module store, not in component state,
 * so this hook sets nothing during render or in effects — it only reads the
 * store and kicks off a fetch. `current` keeps a selection the API no longer
 * lists in the picker, flagged, so opening an old draft doesn't silently
 * change models.
 */
export function useLiveModels(provider: ProviderId, current?: string) {
  const { cache, status: statuses } = store.useValue();
  const { keys, hydrated } = useKeys();
  const { endpoint } = useCustomEndpoint();

  const apiKey = keys[provider];
  const configured =
    !providerNeedsKey(provider) ||
    (!!apiKey && (provider !== "custom" || !!endpoint));
  const cached = cache[provider];
  const fetchStatus = statuses[provider] ?? { state: "idle" as const };
  const canFetch = supportsLiveModels(provider) && configured && !!apiKey;

  const refresh = useCallback(() => {
    if (!canFetch || !apiKey) return;
    // Failures are recorded in the store's status; nothing to do here.
    refreshLiveModels(provider, apiKey).catch(() => {});
  }, [canFetch, apiKey, provider]);

  // One automatic fetch per provider per session. A stale cache refetches;
  // an error waits for an explicit retry rather than looping.
  useEffect(() => {
    if (!hydrated || !canFetch) return;
    if (fetchStatus.state !== "idle") return;
    if (cached && isFresh(cached, Date.now())) return;
    refresh();
  }, [hydrated, canFetch, fetchStatus.state, cached, refresh]);

  // A cached list is used even when stale — it is still the last thing the
  // API said, which beats the hand-typed catalog — and the effect above
  // refreshes it.
  const models = useMemo<ModelMeta[]>(
    () => mergeModels(PROVIDERS[provider].models, cached?.models ?? null, current),
    [provider, cached, current],
  );

  const status: LiveStatus =
    fetchStatus.state === "loading"
      ? "loading"
      : cached
        ? "live"
        : fetchStatus.state === "error"
          ? "error"
          : "static";

  return {
    models,
    status,
    error: fetchStatus.state === "error" ? fetchStatus.error : null,
    fetchedAt: cached?.fetchedAt,
    refresh,
    configured,
  };
}
