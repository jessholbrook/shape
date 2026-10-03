"use client";

import { createLocalStore } from "./hooks/use-local-store";

/**
 * Links this browser has shared, with the delete token for each. The token
 * lives only here: lose this browser's storage and the link can only be taken
 * down by the site owner. The share panel says so.
 */
export type SharedLink = { slug: string; title: string; deleteToken: string; createdAt: number; experimentId: string };

const KEY = "shape:shared-links";
const EVENT = "shape:shared-links";

function read(): SharedLink[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((l) => l && typeof l.slug === "string" && typeof l.deleteToken === "string") : [];
  } catch {
    return [];
  }
}

function write(links: SharedLink[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(links));
  } catch {
    // Blocked storage: the link still works; it just can't be deleted from here later.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function addSharedLink(link: SharedLink): void {
  write([link, ...read().filter((l) => l.slug !== link.slug)]);
}

export function removeSharedLink(slug: string): void {
  write(read().filter((l) => l.slug !== slug));
}

const EMPTY: SharedLink[] = [];
const store = createLocalStore<SharedLink[]>({ events: [EVENT, "storage"], read, serverValue: EMPTY });

export function useSharedLinks(): SharedLink[] {
  return store.useValue();
}
