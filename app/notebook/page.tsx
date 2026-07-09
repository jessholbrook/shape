import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { Notebook } from "./notebook";

export const metadata = {
  title: "Notebook",
  description: "Your in-progress work — drafts of every playground session.",
};

export default function NotebookPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>04</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Your <span className="italic">notebook</span>.
        </h1>

        <div className="mt-12">
          <Notebook />
        </div>
      </section>
    </Shell>
  );
}
