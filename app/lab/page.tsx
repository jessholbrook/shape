import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { LabWorkshop } from "./lab-workshop";

export const metadata = {
  title: "Lab",
  description:
    "Find out whether a change in a model's behavior is real: run each version many times and get results with honest error bars and a full record of what was run.",
};

export default function LabPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Lab</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6 max-w-4xl">
          Is it real, or did you <span className="italic">get lucky</span>?
        </h1>
        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted max-w-2xl mt-5">
          In Play you see one answer, and one answer is an anecdote. Here you run each version of a prompt dozens of
          times and find out whether the difference holds up.
        </p>

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">Loading lab…</p>
            }
          >
            <LabWorkshop />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
