"use client";

import type { MLCEngine, InitProgressReport } from "@mlc-ai/web-llm";

/**
 * Default WebLLM model. Llama 3.2 1B Instruct (q4f16_1) is ~1GB on disk,
 * downloads in ~1-2 min on broadband, and produces output good enough to feel
 * the playgrounds. Larger models exist (Llama 3.2 3B, Phi-3 mini) but the
 * download is enough of a one-time cost that we want the smallest model that
 * doesn't embarrass itself.
 */
export const DEFAULT_WEBLLM_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";

export type WebLLMStatus =
  | { kind: "unsupported" }
  | { kind: "idle" }
  | { kind: "loading"; progress: number; message: string }
  | { kind: "ready"; model: string }
  | { kind: "error"; message: string };

type Listener = (status: WebLLMStatus) => void;

let status: WebLLMStatus = detectInitialStatus();
let engine: MLCEngine | null = null;
let enginePromise: Promise<MLCEngine> | null = null;
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
 * Lazy-load WebLLM and initialize the engine for the default model. Multiple
 * concurrent callers share the same in-flight promise. Reports progress to all
 * subscribers via setStatus.
 */
export async function getEngine(): Promise<MLCEngine> {
  if (engine) return engine;
  if (enginePromise) return enginePromise;
  if (!isWebLLMSupported()) {
    throw new Error(
      "WebGPU is not available in this browser. Bring your own API key to use the playgrounds.",
    );
  }

  enginePromise = (async () => {
    setStatus({
      kind: "loading",
      progress: 0,
      message: "Preparing the in-browser model…",
    });

    // Dynamic import so the @mlc-ai/web-llm bundle isn't shipped to users who
    // bring their own keys.
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");

    try {
      const created = await CreateMLCEngine(DEFAULT_WEBLLM_MODEL, {
        initProgressCallback: (report: InitProgressReport) => {
          setStatus({
            kind: "loading",
            progress: report.progress ?? 0,
            message: report.text ?? "Loading…",
          });
        },
      });
      engine = created;
      setStatus({ kind: "ready", model: DEFAULT_WEBLLM_MODEL });
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message });
      enginePromise = null;
      throw err;
    }
  })();

  return enginePromise;
}
