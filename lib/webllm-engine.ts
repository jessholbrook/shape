"use client";

import type {
  MLCEngine,
  InitProgressReport,
} from "@mlc-ai/web-llm";

/**
 * Default WebLLM model. Llama 3.2 1B Instruct (q4f16_1) is ~1GB on disk and
 * downloads in ~1-2 min on broadband. The full set of registered free models
 * lives in `lib/providers.ts` under PROVIDERS.webllm.models.
 */
export const DEFAULT_WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export type WebLLMStatus =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "loading"; modelId: string; progress: number; message: string }
  | { kind: "ready"; model: string }
  | { kind: "error"; message: string };

type Listener = (status: WebLLMStatus) => void;

let status: WebLLMStatus = detectInitialStatus();
let engine: MLCEngine | null = null;
let currentModelId: string | null = null;
let pendingPromise: Promise<MLCEngine> | null = null;
const listeners = new Set<Listener>();

function detectInitialStatus(): WebLLMStatus {
  if (typeof navigator === "undefined") return { kind: "idle" };
  if (!("gpu" in navigator)) return { kind: "unsupported" };
  return { kind: "idle" };
}

function setStatus(next: WebLLMStatus): void {
  status = next;
  for (const l of listeners) l(next);
}

export function getWebLLMStatus(): WebLLMStatus {
  return status;
}

export function subscribeWebLLMStatus(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isWebLLMSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator;
}

/**
 * Lazy-load WebLLM and initialize (or reload) the engine for the requested
 * model. The singleton engine is reused across model switches via
 * `engine.reload(modelId)`. Multiple concurrent callers share the same
 * in-flight promise.
 */
export async function getEngine(modelId: string): Promise<MLCEngine> {
  if (engine && currentModelId === modelId && status.kind === "ready") {
    return engine;
  }
  if (pendingPromise) {
    await pendingPromise;
    if (engine && currentModelId === modelId) return engine;
  }
  if (!isWebLLMSupported()) {
    throw new Error(
      "WebGPU is not available in this browser. Bring your own API key to use the playgrounds.",
    );
  }

  const onProgress = (report: InitProgressReport) => {
    setStatus({
      kind: "loading",
      modelId,
      progress: report.progress ?? 0,
      message: report.text ?? "Loading…",
    });
  };

  pendingPromise = (async () => {
    setStatus({
      kind: "loading",
      modelId,
      progress: 0,
      message: "Preparing the in-browser model…",
    });
    try {
      if (!engine) {
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        engine = await CreateMLCEngine(modelId, {
          initProgressCallback: onProgress,
        });
      } else {
        engine.setInitProgressCallback(onProgress);
        await engine.reload(modelId);
      }
      currentModelId = modelId;
      setStatus({ kind: "ready", model: modelId });
      return engine;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
      throw err;
    }
  })();

  try {
    return await pendingPromise;
  } finally {
    pendingPromise = null;
  }
}
