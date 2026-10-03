/**
 * Which free way to run the reader picked on /start. Only matters when both
 * are available: the hosted tier normally outranks the in-browser model, so a
 * reader who chose "private, in your browser" would otherwise be switched to
 * hosted Claude on their first playground. Per browser, best-effort.
 */
export type RunPreference = "hosted" | "local";

const KEY = "shape:run-preference";

export function getRunPreference(): RunPreference | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "hosted" || v === "local" ? v : null;
  } catch {
    return null;
  }
}

export function setRunPreference(pref: RunPreference): void {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // Private mode or blocked storage: the playground's own picker still works.
  }
}
