import { Suspense } from "react";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { LabWorkshop } from "./lab-workshop";

export const metadata = {
  title: "Lab",
  description:
    "Ask a model a question and get an answer you could defend: conditions, repeated runs, and results with confidence intervals and a full record of what was run.",
};

export default function LabPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Lab</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Ask a model <span className="italic">a question</span>.
        </h1>
        <p className="font-sans text-[15px] leading-[1.6] text-ink-muted max-w-2xl mt-5">
          One answer is an anecdote. Here you change one thing, run each version many times, and get a result
          with honest error bars — plus a record of exactly what was run, so anyone can check it.
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
