import { LENSES, LENS_IDS, type LensId } from "./lenses";

/**
 * A playground's seed scenario, per lens. `core` is what a reader with no
 * lens sees, and what any lens without its own entry falls back to.
 *
 * Every pack must keep the mechanism its playground's seed exists to expose —
 * the drift Spread measures, the length bias Judge catches. Changing the
 * scenario is fine; losing the lesson is not. `tests/content-consistency`
 * checks each mechanism for every pack.
 */
export type SeedPack<T> = { core: T } & Partial<Record<LensId, T>>;

export type PackKey = "core" | LensId;

export function pickSeed<T>(pack: SeedPack<T>, lens: LensId | null): T {
  return (lens && pack[lens]) || pack.core;
}

/** The packs a playground actually has, in display order, core first. */
export function packKeys<T>(pack: SeedPack<T>): PackKey[] {
  return ["core", ...LENS_IDS.filter((id) => pack[id] !== undefined)];
}

export function packLabel(key: PackKey): string {
  return key === "core" ? "General" : LENSES[key].short;
}

export function seedFor<T>(pack: SeedPack<T>, key: PackKey): T | undefined {
  return key === "core" ? pack.core : pack[key];
}
