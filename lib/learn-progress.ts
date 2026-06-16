const KEY = "shape:learn:read";
const DISMISSED_KEY = "shape:learn:concept-link-dismissed";
const EVENT = "shape:learn-progress-changed";

function readSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s) => typeof s === "string"));
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function markRead(slug: string): void {
  if (typeof window === "undefined") return;
  const set = readSet(KEY);
  if (set.has(slug)) return;
  set.add(slug);
  writeSet(KEY, set);
}

export function getReadSlugs(): Set<string> {
  return readSet(KEY);
}

export function clearReadSlugs(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function dismissConceptLink(slug: string): void {
  if (typeof window === "undefined") return;
  const set = readSet(DISMISSED_KEY);
  if (set.has(slug)) return;
  set.add(slug);
  writeSet(DISMISSED_KEY, set);
}

export function getDismissedConceptLinks(): Set<string> {
  return readSet(DISMISSED_KEY);
}

export const LEARN_PROGRESS_EVENT = EVENT;
