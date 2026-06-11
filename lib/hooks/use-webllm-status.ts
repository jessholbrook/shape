"use client";

import { useSyncExternalStore } from "react";
import {
  getWebLLMStatus,
  subscribeWebLLMStatus,
  type WebLLMStatus,
} from "@/lib/webllm-engine";

/**
 * React subscription to the WebLLM engine status. Tracks load progress so the
 * global banner can show "Downloading model — 42%" while a fresh visitor's
 * first run is fetching weights.
 */
export function useWebLLMStatus(): WebLLMStatus {
  // The engine module keeps a stable status object between changes, so
  // getWebLLMStatus doubles as both client and server snapshot.
  return useSyncExternalStore(
    subscribeWebLLMStatus,
    getWebLLMStatus,
    getWebLLMStatus,
  );
}
