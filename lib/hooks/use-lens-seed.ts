"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { seedFor, type PackKey, type SeedPack } from "../seeds";
import { useLens } from "./use-lens";
import { useHydrated } from "./use-local-store";

/**
 * Which seed scenario a playground is showing, and how to switch it.
 *
 * On first load of a fresh playground, swaps the core seed for the reader's
 * lens pack if the playground has one. Same contract as useDefaultProvider:
 * runs once, after hydration, and never when a draft is being loaded — the
 * draft owns its content (and `active` is null, since it matches no pack).
 * Server and hydration renders always use core, so there is no mismatch; the
 * swap lands before the reader can interact.
 */
export function useLensSeed<T>({
  enabled,
  pack,
  apply,
}: {
  enabled: boolean;
  pack: SeedPack<T>;
  apply: (seed: T) => void;
}) {
  const { lens } = useLens();
  const hydrated = useHydrated();
  const applied = useRef(false);
  const [active, setActive] = useState<PackKey | null>(enabled ? "core" : null);

  // The lens lives in localStorage, unreadable during SSR — the same
  // "synchronize with an external store" exception use-draft-editing takes.
  useEffect(() => {
    if (applied.current || !enabled || !hydrated) return;
    applied.current = true;
    const seed = lens ? pack[lens] : undefined;
    if (lens && seed) {
      apply(seed);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(lens);
    }
  }, [enabled, hydrated, lens, pack, apply]);

  const choose = useCallback(
    (key: PackKey) => {
      const seed = seedFor(pack, key);
      if (!seed) return;
      applied.current = true;
      apply(seed);
      setActive(key);
    },
    [pack, apply],
  );

  return { active, choose };
}
