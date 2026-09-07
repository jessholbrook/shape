import { PROVIDERS, getModel, type ModelMeta, type ProviderId } from "./providers";
import { customModelsUrl, getCustomEndpoint } from "./custom-endpoint";

/**
 * Live model lists.
 *
 * The static catalog in `providers.ts` is right on the day it's written and
 * drifts after that — Gemini retires IDs quarterly, Cerebras's catalog
 * collapsed from a dozen models to two in one summer — and every drift is a
 * silent 404 on a run until someone reports it. So for providers that expose
 * a model-list endpoint, the picker is populated from the API at runtime and
 * the static entries supply what the list endpoints don't: names, tiers,
 * and pricing. A model the API lists but we have no rate card for still
 * shows, with its cost marked unknown rather than fabricated as zero. A
 * model we list but the API no longer does is dropped — unless it is the
 * current selection, which stays visible and flagged so a saved draft
 * doesn't silently change models.
 *
 * Lists are cached per provider for an hour in sessionStorage. One fetch per
 * provider per session is the normal case.
 */

export type LiveModel = {
  id: string;
  name?: string;
  inputPer1M?: number;
  outputPer1M?: number;
};

export type LiveList = {
  provider: ProviderId;
  models: LiveModel[];
  fetchedAt: number;
};

export const LIVE_TTL_MS = 60 * 60 * 1000;
const STORAGE_KEY = "shape:live-models:v1";
export const LIVE_MODELS_EVENT = "shape:live-models-changed";

/** Providers whose list endpoint we know how to call. WebLLM's list is the static one. */
export function supportsLiveModels(provider: ProviderId): boolean {
  return provider !== "webllm";
}

// --- Parsing ---------------------------------------------------------------------

/**
 * OpenAI's list is everything the account can reach — embeddings, TTS,
 * transcription, image models, moderation. Keep what a chat playground can
 * send a message to.
 */
export function chatCapable(provider: ProviderId, id: string): boolean {
  if (provider !== "openai") return true;
  if (!/^(gpt-|o\d|chatgpt-)/.test(id)) return false;
  return !/(embedding|tts|whisper|transcribe|dall-e|realtime|audio|moderation|image|search|instruct|davinci|babbage|codex)/i.test(
    id,
  );
}

type Loose = Record<string, unknown>;

function asRecord(v: unknown): Loose | null {
  return v && typeof v === "object" ? (v as Loose) : null;
}

/** OpenRouter quotes per-token USD as strings; the catalog wants per million. */
function perMillion(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0) return undefined;
  // Per-token strings like "0.0000004" don't multiply cleanly; keep six decimals.
  return Math.round(n * 1_000_000 * 1_000_000) / 1_000_000;
}

export function parseModelList(provider: ProviderId, json: unknown): LiveModel[] {
  const root = asRecord(json);
  if (!root) return [];

  if (provider === "gemini") {
    const models = Array.isArray(root.models) ? root.models : [];
    return models
      .map(asRecord)
      .filter((m): m is Loose => !!m)
      .filter((m) => {
        const methods = Array.isArray(m.supportedGenerationMethods)
          ? (m.supportedGenerationMethods as unknown[])
          : [];
        return methods.includes("generateContent");
      })
      .map((m) => ({
        id: String(m.name ?? "").replace(/^models\//, ""),
        name: typeof m.displayName === "string" ? m.displayName : undefined,
      }))
      .filter((m) => m.id);
  }

  // Anthropic, OpenAI, Cerebras, OpenRouter, LM Studio, Ollama: `{ data: [...] }`.
  const data = Array.isArray(root.data) ? root.data : [];
  return data
    .map(asRecord)
    .filter((m): m is Loose => !!m && typeof m.id === "string" && !!m.id)
    .filter((m) => chatCapable(provider, m.id as string))
    .map((m) => {
      const pricing = asRecord(m.pricing);
      const name =
        typeof m.display_name === "string"
          ? m.display_name
          : typeof m.name === "string"
            ? m.name
            : undefined;
      return {
        id: m.id as string,
        name,
        inputPer1M: pricing ? perMillion(pricing.prompt) : undefined,
        outputPer1M: pricing ? perMillion(pricing.completion) : undefined,
      };
    });
}

// --- Merging ---------------------------------------------------------------------

/**
 * The picker's list: static entries the API still lists (in catalog order,
 * with our names and pricing), then anything the API lists that we don't
 * know (alphabetical, pricing unknown unless the API quoted one), then the
 * current selection if the API dropped it — flagged, not silently swapped.
 */
export function mergeModels(
  staticModels: ModelMeta[],
  live: LiveModel[] | null,
  current?: string,
): ModelMeta[] {
  if (!live) return staticModels;
  const liveById = new Map(live.map((m) => [m.id, m]));
  const known = staticModels
    .filter((m) => liveById.has(m.id))
    .map((m) => {
      const l = liveById.get(m.id)!;
      // A quoted price beats a hand-typed one; ours drift.
      return l.inputPer1M != null && l.outputPer1M != null
        ? { ...m, inputPer1M: l.inputPer1M, outputPer1M: l.outputPer1M }
        : m;
    });
  const knownIds = new Set(staticModels.map((m) => m.id));
  const unknown = live
    .filter((m) => !knownIds.has(m.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(toMeta);
  const out = [...known, ...unknown];
  if (current && !out.some((m) => m.id === current)) {
    const stale = staticModels.find((m) => m.id === current);
    out.push(
      stale
        ? { ...stale, retired: true }
        : { id: current, name: current, inputPer1M: 0, outputPer1M: 0, tier: "balanced", pricingUnknown: true, retired: true },
    );
  }
  return out;
}

function toMeta(m: LiveModel): ModelMeta {
  const priced = m.inputPer1M != null && m.outputPer1M != null;
  return {
    id: m.id,
    name: m.name ?? m.id,
    inputPer1M: priced ? m.inputPer1M! : 0,
    outputPer1M: priced ? m.outputPer1M! : 0,
    tier: "balanced",
    pricingUnknown: !priced,
    live: true,
  };
}

// --- Cache ------------------------------------------------------------------------

type CacheShape = Partial<Record<ProviderId, LiveList>>;
let memory: CacheShape | null = null;

function readCache(): CacheShape {
  if (memory) return memory;
  memory = {};
  if (typeof window === "undefined") return memory;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) memory = JSON.parse(raw) as CacheShape;
  } catch {
    memory = {};
  }
  return memory;
}

function writeCache(next: CacheShape): void {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode — the in-memory copy still serves this page.
  }
  window.dispatchEvent(new CustomEvent(LIVE_MODELS_EVENT));
}

export function isFresh(list: LiveList | undefined, now: number): list is LiveList {
  return !!list && now - list.fetchedAt < LIVE_TTL_MS;
}

/** The cached list for a provider, or null if there isn't one or it's stale. */
export function getLiveList(provider: ProviderId, now = Date.now()): LiveList | null {
  const list = readCache()[provider];
  return isFresh(list, now) ? list : null;
}

/** The whole cache, for a store snapshot. Stale entries included; callers check freshness. */
export function getLiveCache(): CacheShape {
  return readCache();
}

export function setLiveList(provider: ProviderId, models: LiveModel[], now = Date.now()): void {
  writeCache({ ...readCache(), [provider]: { provider, models, fetchedAt: now } });
}

export function clearLiveList(provider: ProviderId): void {
  const next = { ...readCache() };
  delete next[provider];
  writeCache(next);
}

// --- Fetch status ------------------------------------------------------------------

export type LiveFetchStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "error"; error: string };

const statuses: Partial<Record<ProviderId, LiveFetchStatus>> = {};

/** Per-provider fetch state, kept here rather than in component state so the hook stays pure. */
export function getLiveStatus(): Partial<Record<ProviderId, LiveFetchStatus>> {
  return statuses;
}

function setStatus(provider: ProviderId, status: LiveFetchStatus): void {
  statuses[provider] = status;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LIVE_MODELS_EVENT));
  }
}

// --- Resolution --------------------------------------------------------------------

/**
 * Static catalog first, then the live cache. This is what cost estimates
 * read, so a live model with a quoted price (OpenRouter) is costed and one
 * without is marked unknown rather than silently free.
 */
export function resolveModel(provider: ProviderId, id: string): ModelMeta | undefined {
  const known = getModel(provider, id);
  const live = getLiveList(provider)?.models.find((m) => m.id === id);
  if (known) {
    return live && live.inputPer1M != null && live.outputPer1M != null
      ? { ...known, inputPer1M: live.inputPer1M, outputPer1M: live.outputPer1M }
      : known;
  }
  return live ? toMeta(live) : undefined;
}

/** Display name for any model, live or static, falling back to the id. */
export function modelName(provider: ProviderId, id: string): string {
  return resolveModel(provider, id)?.name ?? id;
}

// --- Fetching ----------------------------------------------------------------------

const ANTHROPIC_MODELS = "https://api.anthropic.com/v1/models?limit=100";
const GEMINI_MODELS = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200";

function requestFor(provider: ProviderId, apiKey: string): { url: string; headers: Record<string, string> } {
  switch (provider) {
    case "anthropic":
      return {
        url: ANTHROPIC_MODELS,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
      };
    case "gemini":
      return { url: GEMINI_MODELS, headers: { "x-goog-api-key": apiKey } };
    case "openai":
      // Blocked from the browser; the proxy's GET forwards to /v1/models.
      return { url: "/api/proxy/openai", headers: { "x-shape-openai-key": apiKey } };
    case "cerebras":
      return { url: "/api/proxy/cerebras", headers: { "x-shape-cerebras-key": apiKey } };
    case "custom": {
      const endpoint = getCustomEndpoint();
      if (!endpoint) throw new Error("Set a custom endpoint URL in Keys first.");
      return {
        url: customModelsUrl(endpoint.baseUrl),
        headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
      };
    }
    default:
      throw new Error(`${PROVIDERS[provider].name} has no model-list endpoint.`);
  }
}

const inflight = new Map<ProviderId, Promise<LiveModel[]>>();

/**
 * Fetch, parse, cache, announce. Concurrent callers share one request.
 * Errors propagate to the caller — a failed refresh leaves the cache alone,
 * so the picker keeps whatever it had (static or last good list).
 */
export async function refreshLiveModels(
  provider: ProviderId,
  apiKey: string,
): Promise<LiveModel[]> {
  const pending = inflight.get(provider);
  if (pending) return pending;
  setStatus(provider, { state: "loading" });
  const task = (async () => {
    const { url, headers } = requestFor(provider, apiKey);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = text.slice(0, 200);
      try {
        const json = JSON.parse(text);
        message = json?.error?.message ?? json?.message ?? message;
      } catch {
        // not JSON
      }
      throw new Error(`${PROVIDERS[provider].name} ${res.status}: ${message || res.statusText}`);
    }
    const models = parseModelList(provider, await res.json());
    setLiveList(provider, models);
    return models;
  })();
  inflight.set(provider, task);
  try {
    const models = await task;
    setStatus(provider, { state: "idle" });
    return models;
  } catch (err) {
    setStatus(provider, {
      state: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    inflight.delete(provider);
  }
}
