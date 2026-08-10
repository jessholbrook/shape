import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { SpreadMode } from "./spread-mode";

export const metadata = {
  title: "Spread",
  description:
    "Run one configuration N times and score the variance. Find out which clauses of your spec actually hold.",
};

export default function SpreadPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>07</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          <span className="italic">Spread</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          One config, run many times. Diff Mode compares two prompts; this
          compares a prompt against itself — and tells you which clauses of
          your spec were luck.
        </p>

        <ConceptLink playgroundHref="/play/spread" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <SpreadMode />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
