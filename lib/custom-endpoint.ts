/**
 * The custom OpenAI-compatible endpoint — any `/chat/completions` base URL
 * the user points Shape at: OpenRouter, Groq, Together, a local LM Studio or
 * Ollama. Stored in localStorage next to the keys, never sent anywhere but
 * to the endpoint itself.
 *
 * Calls go straight from the browser. There is deliberately no proxy for
 * this provider: an edge route that forwards to a user-supplied URL is an
 * open relay, and the endpoints people actually use (OpenRouter, local
 * servers) allow browser calls anyway.
 */

const STORAGE_KEY = "shape:custom-endpoint";
export const CUSTOM_ENDPOINT_EVENT = "shape:custom-endpoint-changed";

export type CustomEndpoint = {
  /** Base URL up to and including the version segment, e.g. https://openrouter.ai/api/v1 */
  baseUrl: string;
  /**
   * A local server that wants no key — LM Studio, Ollama. Calls go out with
   * no Authorization header, and the playgrounds stop asking for one.
   */
  keyless?: boolean;
};

export function getCustomEndpoint(): CustomEndpoint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomEndpoint>;
    if (typeof parsed?.baseUrl !== "string" || !parsed.baseUrl) return null;
    return { baseUrl: parsed.baseUrl, keyless: parsed.keyless === true };
  } catch {
    return null;
  }
}

export function setCustomEndpoint(baseUrl: string, options: { keyless?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ baseUrl: normalizeBaseUrl(baseUrl), keyless: options.keyless === true }),
  );
  window.dispatchEvent(new CustomEvent(CUSTOM_ENDPOINT_EVENT));
}

export function clearCustomEndpoint(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CUSTOM_ENDPOINT_EVENT));
}

/** Trim, drop a trailing slash, and drop a trailing `/chat/completions` if someone pasted the full URL. */
export function normalizeBaseUrl(input: string): string {
  let url = input.trim();
  url = url.replace(/\/+$/, "");
  url = url.replace(/\/chat\/completions$/i, "");
  url = url.replace(/\/models$/i, "");
  return url;
}

export type BaseUrlValidation = { ok: true } | { ok: false; reason: string };

export function validateBaseUrl(input: string): BaseUrlValidation {
  const url = normalizeBaseUrl(input);
  if (!url) return { ok: false, reason: "Base URL is empty." };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "That isn't a URL. Paste the base, e.g. https://openrouter.ai/api/v1." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: "The base URL has to start with http:// or https://." };
  }
  if (parsed.protocol === "http:" && !isLoopback(parsed.hostname)) {
    return {
      ok: false,
      reason: "Plain http is only allowed for localhost — your key would travel unencrypted.",
    };
  }
  return { ok: true };
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export function customChatUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

export function customModelsUrl(baseUrl: string): string {
  return `${normalizeBaseUrl(baseUrl)}/models`;
}

/** A short label for the endpoint — its host — for pills and summaries. */
export function endpointLabel(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}
