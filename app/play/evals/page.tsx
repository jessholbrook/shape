import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { EvalsWorkshop } from "./evals-workshop";

export const metadata = {
  title: "Eval Lab",
  description:
    "Rubric-based evaluation. Define what good looks like, run a panel of cases, score each output against your rubric.",
};

export default function EvalsPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Playground">06</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Eval <span className="italic">lab</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Define what good looks like, then score the model against it.
          Same shape as a usability rubric, applied to behavior.
        </p>

        <ConceptLink playgroundHref="/play/evals" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <EvalsWorkshop />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
