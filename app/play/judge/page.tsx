import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { JudgeLab } from "./judge-lab";

export const metadata = {
  title: "Judge Lab",
  description:
    "Automate the scoring, then check the automation. Swap the order and find out whether your judge was reading quality or position.",
};

export default function JudgePage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>12</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Judge <span className="italic">lab</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Hand the scoring to a model, then check whether you can trust it.
          Every comparison runs twice, with the answers swapped — a judge
          reading quality gives the same verdict, and a judge reading position
          doesn&apos;t.
        </p>

        <ConceptLink playgroundHref="/play/judge" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <JudgeLab />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
