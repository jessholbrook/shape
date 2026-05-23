const KEY = "shape:handle";
const EVENT = "shape:handle-changed";

/** Slug-safe handle. 2-32 chars, lowercase alphanumerics + hyphens. */
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$|^[a-z0-9]{2,32}$/;

export type HandleValidation =
  | { ok: true; normalized: string }
  | { ok: false; reason: string };

export function validateHandle(raw: string): HandleValidation {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "Pick a handle to publish under." };
  if (normalized.length < 2)
    return { ok: false, reason: "Handles need at least 2 characters." };
  if (normalized.length > 32)
    return { ok: false, reason: "Handles can be at most 32 characters." };
  if (!HANDLE_RE.test(normalized))
    return {
      ok: false,
      reason: "Lowercase letters, numbers, and hyphens only.",
    };
  return { ok: true, normalized };
}

export function getHandle(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setHandle(handle: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, handle);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearHandle(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export const HANDLE_EVENT = EVENT;
