"use client";

import { useEffect, useRef } from "react";
import { PROVIDERS, preferredProvider, type ProviderId } from "@/lib/providers";
import { useKeys } from "./use-keys";

/**
 * On first load of a fresh playground, default the provider/model to a BYOK
 * provider the user has already set up (falling back to the free in-browser
 * model). Runs exactly once, after keys hydrate, and never overrides a draft
 * being loaded or a selection the user has already made.
 *
 * The state write happens through the opaque `onResolve` callback, so the
 * caller owns its provider/model setters — this hook stays state-agnostic and
 * works for both single-provider playgrounds and Diff Mode's two configs.
 */
export function useDefaultProvider({
  enabled,
  onResolve,
}: {
  /** False when a draft is being loaded — the draft owns provider/model. */
  enabled: boolean;
  onResolve: (provider: ProviderId, model: string) => void;
}) {
  const { keys, hydrated } = useKeys();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || !enabled || !hydrated) return;
    applied.current = true;
    const pref = preferredProvider(keys);
    // webllm is already the initial default; only switch when a key exists.
    if (pref !== "webllm") {
      onResolve(pref, PROVIDERS[pref].defaultModel);
    }
  }, [enabled, hydrated, keys, onResolve]);
}
