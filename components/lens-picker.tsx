"use client";

import { LENSES, LENS_IDS } from "@/lib/lenses";
import { useLens } from "@/lib/hooks/use-lens";
import { useHydrated } from "@/lib/hooks/use-local-store";

/**
 * "I come from…" chip row. Picking a lens swaps the bridges and suggested
 * path on the home page; "Just exploring" clears it back to the neutral core.
 */
export function LensPicker() {
  const { lens, setLens } = useLens();
  const hydrated = useHydrated();
  const active = hydrated ? lens : null;

  const chip = (selected: boolean) =>
    `rounded-full border px-4 py-1.5 font-sans text-[14px] transition-colors ${
      selected
        ? "bg-ink text-canvas border-ink"
        : "border-line text-ink-muted hover:border-ink hover:text-ink"
    }`;

  return (
    <div role="group" aria-label="I come from" className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet mr-2">
        I come from
      </span>
      {LENS_IDS.map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={active === id}
          className={chip(active === id)}
          onClick={() => setLens(active === id ? null : id)}
        >
          {LENSES[id].name}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={active === null}
        className={chip(active === null)}
        onClick={() => setLens(null)}
      >
        Just exploring
      </button>
    </div>
  );
}
