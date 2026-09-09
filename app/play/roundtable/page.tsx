import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { RoundtableWorkshop } from "./roundtable-workshop";

export const metadata = {
  title: "Roundtable",
  description:
    "Three seats, one decision, a planted dissenter. Edit the protocol — who speaks first, whether the first round is blind, when it stops — and watch the room decide, not the prompts.",
};

export default function RoundtablePage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>13</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Round<span className="italic">table</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Put three models at a table with one decision to make and one of
          them planted to disagree. Then change the room, not the prompts:
          who speaks first, whether the first round is blind, when the table
          stops. Watch who gives way, and when.
        </p>

        <ConceptLink playgroundHref="/play/roundtable" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <RoundtableWorkshop />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
