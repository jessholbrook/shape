import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { EvalsWorkshop } from "./evals-workshop";

export const metadata = {
  title: "Eval Workshop — Shape",
  description:
    "Rubric-based evaluation. Define what good looks like, run a panel of cases, score each output against your rubric.",
};

export default function EvalsPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Playground">06</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Eval <span className="italic">workshop</span>
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            Define what good looks like, then score the model against it.
            Same shape as a usability rubric, applied to behavior.
          </p>
        </div>

        <ConceptLink playgroundHref="/play/evals" />

        <div className="mt-12">
          <EvalsWorkshop />
        </div>
      </section>
    </Shell>
  );
}
