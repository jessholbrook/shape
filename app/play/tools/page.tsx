import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { ToolBench } from "./tool-bench";

export const metadata = {
  title: "Tool Bench",
  description:
    "Give the assistant things it can do, then find out where it draws the line between acting and asking.",
};

export default function ToolsPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>11</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Tool <span className="italic">bench</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Now it does things, not just says things. Write the tools, write the
          policy, and find out where the model actually draws the line between
          asking and acting.
        </p>

        <ConceptLink playgroundHref="/play/tools" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <ToolBench />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
