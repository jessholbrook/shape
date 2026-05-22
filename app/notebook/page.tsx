import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { Notebook } from "./notebook";

export const metadata = {
  title: "Notebook — Shape",
  description: "Your in-progress work — drafts of every playground session.",
};

export default function NotebookPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Notebook">06</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Your <span className="italic">notebook</span>.
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            Every saved draft lives here, in this browser. Open one to keep
            working on it; later, publish the polished ones as artifacts.
          </p>
        </div>

        <div className="mt-12">
          <Notebook />
        </div>
      </section>
    </Shell>
  );
}
