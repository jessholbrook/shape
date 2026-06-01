"use client";

import { useEffect, useState } from "react";
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
  const [status, setStatus] = useState<WebLLMStatus>(() => getWebLLMStatus());
  useEffect(() => {
    setStatus(getWebLLMStatus());
    return subscribeWebLLMStatus(setStatus);
  }, []);
  return status;
}
