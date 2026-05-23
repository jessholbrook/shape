const KEY = "shape:learn:read";
const EVENT = "shape:learn-progress-changed";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s) => typeof s === "string"));
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function markRead(slug: string): void {
  if (typeof window === "undefined") return;
  const set = read();
  if (set.has(slug)) return;
  set.add(slug);
  write(set);
}

export function getReadSlugs(): Set<string> {
  return read();
}

export function clearReadSlugs(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const LEARN_PROGRESS_EVENT = EVENT;
