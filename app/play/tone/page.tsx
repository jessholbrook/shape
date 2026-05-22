import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ToneDial } from "./tone-dial";

export const metadata = {
  title: "Tone Dial — Shape",
  description:
    "Style as a design token. Tune voice dials and watch the system prompt — and the model's behavior — shift.",
};

export default function TonePage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Playground">03</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Tone <span className="italic">dial</span>
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            Style as a design token. Move a dial, watch the system prompt
            compose itself, then run it and feel the shift.
          </p>
        </div>

        <div className="mt-12">
          <ToneDial />
        </div>
      </section>
    </Shell>
  );
}
