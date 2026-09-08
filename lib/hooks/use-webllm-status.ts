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
/** What the server renders, and what the client renders while hydrating: nothing decided yet. */
const SERVER_STATUS: WebLLMStatus = { kind: "idle" };

export function useWebLLMStatus(): WebLLMStatus {
  // The server snapshot is a fixed "idle" so the HTML never carries a
  // support verdict the client might disagree with; React swaps in the real
  // status right after hydration, without a mismatch.
  return useSyncExternalStore(
    subscribeWebLLMStatus,
    getWebLLMStatus,
    () => SERVER_STATUS,
  );
}
