"use client";

import { useEffect, useState } from "react";
import {
  consumeUnsavedLeaveToast,
  subscribeUnsavedLeaveToast,
} from "@/lib/hooks/use-unsaved-work";

const DISMISS_MS = 7000;

/**
 * Gentle, auto-dismissing heads-up shown when the user has navigated away from
 * a playground that still had unsaved output. Non-blocking by design — it
 * never intercepts the navigation, it just reminds. Mounted once in the Shell;
 * reads the module-level flag that survives the client-side route change.
 */
export function UnsavedToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (consumeUnsavedLeaveToast()) setShow(true);
    return subscribeUnsavedLeaveToast(() => setShow(true));
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), DISMISS_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div
      data-print-hide
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:left-auto md:right-6 md:translate-x-0 max-w-[calc(100vw-2rem)] w-[380px]"
    >
      <div className="bg-ink text-canvas rounded-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] px-4 py-3 flex items-start gap-3">
        <p className="font-sans text-[13px] leading-[1.5] flex-1">
          Those outputs weren&apos;t saved. Next time, use the{" "}
          <span className="text-highlight">Save draft</span> bar at the bottom
          of a playground to keep your work.
        </p>
        <button
          type="button"
          onClick={() => setShow(false)}
          aria-label="Dismiss"
          className="shrink-0 -mr-1 -mt-0.5 w-6 h-6 inline-flex items-center justify-center text-canvas/60 hover:text-canvas rounded-full leading-none text-[16px]"
        >
          ×
        </button>
      </div>
    </div>
  );
}
