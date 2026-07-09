import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { LearnIndex } from "@/components/learn/learn-index";

export const metadata = {
  title: "Learn",
  description:
    "Seven micro-lessons that pair a short explanation with a hands-on playground.",
};

export default function LearnPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>02</SectionNumber>

        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink mt-8 max-w-4xl">
          Model behavior designer{" "}
          <span className="italic">101 → 201</span>.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-2xl">
          Seven micro-lessons that pair a short explanation with a
          hands-on playground to explore the concept. Read in order or
          jump around.
        </p>

        <LearnIndex />
      </section>
    </Shell>
  );
}
