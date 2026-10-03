"use client";

import { packKeys, packLabel, type PackKey, type SeedPack } from "@/lib/seeds";

/**
 * "Example:" chip row — switch a playground between its seed scenarios.
 * Switching replaces the editable content, so it asks first when the reader
 * has changed anything.
 */
export function SeedPackPicker<T>({
  pack,
  active,
  onChoose,
  hasChanges,
  disabled,
}: {
  pack: SeedPack<T>;
  active: PackKey | null;
  onChoose: (key: PackKey) => void;
  /** True when switching would discard the reader's edits or results. */
  hasChanges: boolean;
  disabled?: boolean;
}) {
  const keys = packKeys(pack);
  if (keys.length < 2) return null;

  function choose(key: PackKey) {
    if (key === active) return;
    if (
      hasChanges &&
      !window.confirm("Load this example? It replaces your current setup and clears results.")
    ) {
      return;
    }
    onChoose(key);
  }

  return (
    <div role="group" aria-label="Example scenario" className="flex flex-wrap items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mr-2">
        Example
      </span>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          aria-pressed={active === key}
          onClick={() => choose(key)}
          className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-[8px] px-3 py-1.5 transition-colors disabled:cursor-not-allowed ${
            active === key
              ? "bg-ink text-canvas"
              : "text-ink-muted hover:text-ink disabled:opacity-50"
          }`}
        >
          {packLabel(key)}
        </button>
      ))}
    </div>
  );
}
