import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { DiffMode } from "./diff-mode";

export const metadata = {
  title: "Diff Mode — Shape",
  description:
    "Run the same prompt through two configurations side-by-side. See how prompts shape outputs.",
};

export default function DiffPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Playground">02</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Diff <span className="italic">mode</span>
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            One prompt, two configurations, side by side. The fastest way to
            feel how prompts shape outputs.
          </p>
        </div>

        <ConceptLink playgroundHref="/play/diff" />

        <div className="mt-12">
          <DiffMode />
        </div>
      </section>
    </Shell>
  );
}
