import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { ContextLabMode } from "./context-lab-mode";

export const metadata = {
  title: "Context Lab",
  description:
    "One question, several context sets. Find out where the answer actually came from — and what happens when the wrong document is in the window.",
};

export default function ContextPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>10</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Context <span className="italic">lab</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          One question, several context sets. Your system prompt is a small
          fraction of what the model reads — this shows you the rest, and where
          the answer actually came from.
        </p>

        <ConceptLink playgroundHref="/play/context" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <ContextLabMode />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
