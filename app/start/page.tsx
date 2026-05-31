import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { StartFlow } from "./start-flow";

export const metadata = {
  title: "Start",
  description:
    "Module 0 — bring your own key, take it for a drive. The first five minutes of Shape.",
};

export default function StartPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[860px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Module 0">00</SectionNumber>

        <h1 className="font-display text-[56px] md:text-[80px] leading-[0.98] tracking-tight text-ink mt-6">
          Bring <span className="italic">your</span> key.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-xl">
          Shape runs on your own model access. Five minutes to set up, then
          every playground is yours. Your key never leaves your browser.
        </p>

        <div className="mt-16">
          <StartFlow />
        </div>
      </section>
    </Shell>
  );
}
