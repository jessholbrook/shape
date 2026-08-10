import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { PortabilityMode } from "./portability-mode";

export const metadata = {
  title: "Portability",
  description:
    "Run one spec across several models. Find out which clauses are real rules and which are incantations tuned to one vendor.",
};

export default function PortabilityPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>09</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          <span className="italic">Portability</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          One spec, several models. Spread asks whether a clause survives
          resampling; this asks whether it survives a change of vendor — and
          how much of your prompt turns out to be an incantation.
        </p>

        <ConceptLink playgroundHref="/play/portability" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <PortabilityMode />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
