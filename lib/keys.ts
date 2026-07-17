import { ProviderId, PROVIDERS } from "./providers";

const KEY_NAMESPACE = "shape:key:";

function storageKey(providerId: ProviderId) {
  return `${KEY_NAMESPACE}${providerId}`;
}

export function getKey(providerId: ProviderId): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(storageKey(providerId));
}

export function setKey(providerId: ProviderId, key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(storageKey(providerId), key);
  window.dispatchEvent(new CustomEvent("shape:keys-changed"));
}

export function clearKey(providerId: ProviderId): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(providerId));
  window.dispatchEvent(new CustomEvent("shape:keys-changed"));
}

export function clearAllKeys(): void {
  if (typeof window === "undefined") return;
  Object.keys(PROVIDERS).forEach((id) => {
    localStorage.removeItem(storageKey(id as ProviderId));
  });
  window.dispatchEvent(new CustomEvent("shape:keys-changed"));
}

export function maskKey(key: string): string {
  if (key.length <= 12) return "•".repeat(key.length);
  return `${key.slice(0, 6)}${"•".repeat(8)}${key.slice(-4)}`;
}

export type KeyValidation = {
  ok: boolean;
  reason?: string;
};

export function validateKey(providerId: ProviderId, key: string): KeyValidation {
  const provider = PROVIDERS[providerId];
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, reason: "Key is empty." };
  if (
    provider.keyPrefixes.length > 0 &&
    !provider.keyPrefixes.some((prefix) => trimmed.startsWith(prefix))
  ) {
    const list = provider.keyPrefixes.map((p) => `"${p}"`).join(" or ");
    return {
      ok: false,
      reason: `Expected key to start with ${list}.`,
    };
  }
  if (trimmed.length < provider.keyMinLength) {
    return {
      ok: false,
      reason: `Key looks too short (expected at least ${provider.keyMinLength} characters).`,
    };
  }
  return { ok: true };
}
