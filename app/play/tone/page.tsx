import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConceptLink } from "@/components/play/concept-link";
import { ToneDial } from "./tone-dial";

export const metadata = {
  title: "Tone Dial",
  description:
    "Style as a design token. Tune voice dials and watch the system prompt — and the model's behavior — shift.",
};

export default function TonePage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>03</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Tone <span className="italic">dial</span>
        </h1>
        <p className="font-sans text-[14px] text-ink-muted max-w-md mt-5">
          Style as a design token. Move a dial, watch the system prompt
          compose itself, then run it and feel the shift.
        </p>

        <ConceptLink playgroundHref="/play/tone" />

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading playground…
              </p>
            }
          >
            <ToneDial />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
