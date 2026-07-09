import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { RefusalLab } from "./refusal-lab";

export const metadata = {
  title: "Refusal Lab",
  description:
    "Boundary design with a panel of edge cases. Tune refusal guidelines and score the model against expected behavior.",
};

export default function RefusalPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>05</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Refusal <span className="italic">lab</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Boundary design with a panel of edge cases. Where the model says
          no — and where it shouldn&apos;t — is a design surface.
        </p>

        <ConceptLink playgroundHref="/play/refusal" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <RefusalLab />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
