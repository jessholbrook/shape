import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { Choreographer } from "./choreographer-page";

export const metadata = {
  title: "Conversation Choreographer",
  description:
    "Write the user's side of a conversation in advance and run it. Same script, different system prompt — see how the model holds the thread across turns.",
};

export default function ChoreographerPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>06</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Conversation <span className="italic">choreographer</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Write the user&apos;s side of a conversation in advance, then
          run it. Because the questions are fixed, you can change the
          system prompt and re-run the same script — the only thing that
          varies is how the model holds the thread across turns.
        </p>

        <ConceptLink playgroundHref="/play/choreographer" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <Choreographer />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
