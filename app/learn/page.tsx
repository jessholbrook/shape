import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { LearnIndex } from "@/components/learn/learn-index";

export const metadata = {
  title: "Learn — Shape",
  description:
    "Eight modules from Behavior Designer 101 to 301. Concept articles paired with playgrounds.",
};

export default function LearnPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Learn">04</SectionNumber>

        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink mt-8 max-w-4xl">
          Behavior designer{" "}
          <span className="italic">101 → 301</span>.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-2xl">
          Setup, then eight concept modules. Each pairs a short article with a
          hands-on playground and a portfolio artifact. Read in order or jump
          around — modules never gate each other.
        </p>

        <LearnIndex />
      </section>
    </Shell>
  );
}
