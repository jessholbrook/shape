import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { StartFlow } from "./start-flow";

export const metadata = {
  title: "Start",
  description:
    "The first five minutes of Shape. Free in your browser, or bring your own key for bigger models.",
};

export default function StartPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[860px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Setup">00</SectionNumber>

        <h1 className="font-display text-[56px] md:text-[80px] leading-[0.98] tracking-tight text-ink mt-6">
          Start <span className="italic">shaping</span>.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-xl">
          Free in this browser — no key needed. Bring an Anthropic or
          OpenAI key when you want bigger models. Either way, everything
          stays on your machine.
        </p>

        <div className="mt-16">
          <StartFlow />
        </div>
      </section>
    </Shell>
  );
}
