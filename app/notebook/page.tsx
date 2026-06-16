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
        <SectionNumber label="Notebook">06</SectionNumber>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink">
            Your <span className="italic">notebook</span>.
          </h1>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            Every saved draft lives here, in this browser — private, instant,
            no account. Export one to JSON or PDF when you want to keep it
            elsewhere or share it.
          </p>
        </div>

        <div className="mt-3 max-w-2xl rounded-[12px] border border-line bg-surface px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
            Why save here vs. download
          </p>
          <p className="font-sans text-[13px] leading-[1.55] text-ink-muted mt-1.5">
            Saving keeps a draft in this browser so you can reopen and keep
            iterating — nothing leaves your machine, but it&apos;s tied to this
            browser. Exporting (JSON or PDF) makes a portable copy you can move
            to another device, attach to a doc, or hand to someone else.
          </p>
        </div>

        <div className="mt-12">
          <Notebook />
        </div>
      </section>
    </Shell>
  );
}
