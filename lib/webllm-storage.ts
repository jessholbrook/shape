"use client";

/**
 * Utilities for inspecting and clearing what the in-browser model put on the
 * user's disk. Beta testers asked: "what just got downloaded, and how do I
 * undo it if I'm worried?" — these answer both.
 */

const NAME_RE = /webllm|mlc/i;

/**
 * Total bytes the origin currently uses. This is a whole-origin estimate
 * (IndexedDB + Cache Storage + localStorage), but the in-browser model
 * dominates by 2-3 orders of magnitude in practice, so it's a fair proxy
 * for "size of the local model" — and we say so in the UI.
 */
export async function getOriginStorageUsage(): Promise<number | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const { usage } = await navigator.storage.estimate();
    return usage ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete every WebLLM / MLC IndexedDB database and Cache Storage entry. The
 * caller is expected to call `resetEngineSingleton()` first so the engine
 * isn't holding live references to the data we're about to wipe.
 */
export async function clearLocalModelStorage(): Promise<void> {
  if (typeof window === "undefined") return;

  await deleteMatchingDatabases();
  await deleteMatchingCaches();
}

async function deleteMatchingDatabases(): Promise<void> {
  // indexedDB.databases() is supported in all evergreen browsers we target.
  const dbApi = indexedDB as IDBFactory & {
    databases?: () => Promise<{ name?: string }[]>;
  };
  if (!dbApi.databases) return;
  let entries: { name?: string }[] = [];
  try {
    entries = await dbApi.databases();
  } catch {
    return;
  }
  const targets = entries
    .map((e) => e.name)
    .filter((n): n is string => !!n && NAME_RE.test(n));
  await Promise.all(targets.map(deleteDatabase));
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

async function deleteMatchingCaches(): Promise<void> {
  if (typeof caches === "undefined") return;
  let names: string[] = [];
  try {
    names = await caches.keys();
  } catch {
    return;
  }
  await Promise.all(
    names.filter((n) => NAME_RE.test(n)).map((n) => caches.delete(n)),
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
