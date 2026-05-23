import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { RefusalLab } from "./refusal-lab";

export const metadata = {
  title: "Refusal Lab — Shape",
  description:
    "Boundary design with a panel of edge cases. Tune refusal guidelines and score the model against expected behavior.",
};

export default function RefusalPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Playground">05</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Refusal <span className="italic">lab</span>
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            Boundary design with a panel of edge cases. Where the model says
            no — and where it shouldn&apos;t — is a design surface.
          </p>
        </div>

        <ConceptLink playgroundHref="/play/refusal" />

        <div className="mt-12">
          <RefusalLab />
        </div>
      </section>
    </Shell>
  );
}
