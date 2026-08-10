import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { RaceMode } from "./race-mode";

export const metadata = {
  title: "Race",
  description:
    "One prompt, two models, side by side. Measure what quality actually costs in time and money.",
};

export default function RacePage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>08</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          <span className="italic">Race</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          One prompt, two models, at the same time. Diff Mode asks what
          changed; this asks what the better answer cost you — in seconds and
          in dollars.
        </p>

        <ConceptLink playgroundHref="/play/race" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <RaceMode />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
