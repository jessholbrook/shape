import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { PersonaWorkshop } from "./persona-workshop";

export const metadata = {
  title: "Persona Lab",
  description:
    "Character design for AI. Build a persona — name, role, voice, blind spots — and watch the model embody them.",
};

export default function PersonaPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>04</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Persona <span className="italic">lab</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Design a character — backstory, beliefs, voice, blind spots — and
          watch the model embody them.
        </p>

        <ConceptLink playgroundHref="/play/persona" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <PersonaWorkshop />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
