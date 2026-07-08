"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";

/**
 * Route-segment error boundary. Replaces a crashed page with a branded,
 * recoverable screen instead of an unstyled stack trace. The error is logged
 * so it surfaces in Vercel's runtime logs; `reset()` re-renders the segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <Shell>
      <section className="mx-auto max-w-[860px] px-6 md:px-12 pt-16 md:pt-24 pb-32">
        <SectionNumber label="Error">!</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[72px] leading-[1.0] tracking-tight text-ink mt-6">
          Something <span className="italic">broke</span>.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-6 max-w-xl">
          A part of this page hit an error. Your saved drafts are untouched —
          they live in your browser, not on a server. Try again, and if it
          keeps happening, the Feedback button in the corner sends us the
          details.
        </p>

        {error.digest && (
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            Reference — {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-6 py-3 font-sans text-[15px] hover:bg-ink/90 transition-colors"
          >
            Try again
            <span className="text-highlight">→</span>
          </button>
          <Link
            href="/"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Back home →
          </Link>
        </div>
      </section>
    </Shell>
  );
}
