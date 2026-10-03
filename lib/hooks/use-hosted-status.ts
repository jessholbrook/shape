"use client";

import { useEffect } from "react";
import { createLocalStore } from "./use-local-store";

/**
 * Is Shape's hosted free tier usable right now, and how many runs are left
 * today? Asked once per page load from /api/hosted/status, then kept current
 * from the quota headers on every hosted call.
 *
 * Until the answer arrives the tier counts as off and unresolved — playgrounds
 * wait for `resolved` before picking a default provider, so nobody is
 * defaulted onto a tier that turns out to be closed.
 */
export type HostedState = {
  resolved: boolean;
  enabled: boolean;
  remaining: number;
  limit: number;
  resetsAt: string | null;
};

const EVENT = "shape:hosted-status";
const INITIAL: HostedState = { resolved: false, enabled: false, remaining: 0, limit: 0, resetsAt: null };

let state: HostedState = INITIAL;
let inflight: Promise<void> | null = null;

function set(next: Partial<HostedState>) {
  state = { ...state, ...next };
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function hostedSnapshot(): HostedState {
  return state;
}

/** Fetch status once per page load; later callers share the same request. */
export function loadHostedStatus(fetcher: typeof fetch = fetch): Promise<void> {
  if (inflight) return inflight;
  inflight = fetcher("/api/hosted/status", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s: { enabled?: boolean; remaining?: number; limit?: number; resetsAt?: string } | null) => {
      set({
        resolved: true,
        enabled: !!s?.enabled && (s?.remaining ?? 0) > 0,
        remaining: s?.remaining ?? 0,
        limit: s?.limit ?? 0,
        resetsAt: s?.resetsAt ?? null,
      });
    })
    .catch(() => set({ resolved: true, enabled: false }));
  return inflight;
}

/** Called by the hosted provider after each call, from the response headers. */
export function noteHostedQuota(remaining: number, limit: number) {
  set({ remaining, limit, enabled: remaining > 0 });
}

/** Called when the server refuses for a reason that closes the tier (daily, monthly, off). */
export function closeHosted() {
  set({ enabled: false, remaining: 0 });
}

const store = createLocalStore<HostedState>({ events: [EVENT], read: () => state, serverValue: INITIAL });

export function useHostedStatus(): HostedState {
  useEffect(() => {
    void loadHostedStatus();
  }, []);
  return store.useValue();
}
