import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { PersonaWorkshop } from "./persona-workshop";

export const metadata = {
  title: "Persona Workshop — Shape",
  description:
    "Character design for AI. Build a persona — name, role, voice, blind spots — and watch the model embody them.",
};

export default function PersonaPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Playground">04</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Persona <span className="italic">workshop</span>
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            Design a character — backstory, beliefs, voice, blind spots — and
            watch the model embody them.
          </p>
        </div>

        <div className="mt-12">
          <PersonaWorkshop />
        </div>
      </section>
    </Shell>
  );
}
