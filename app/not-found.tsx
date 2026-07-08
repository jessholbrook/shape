import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";

export const metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <Shell>
      <section className="mx-auto max-w-[860px] px-6 md:px-12 pt-16 md:pt-24 pb-32">
        <SectionNumber label="404">—</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[72px] leading-[1.0] tracking-tight text-ink mt-6">
          This page <span className="italic">wandered off</span>.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-6 max-w-xl">
          The link may be old, or the page never existed. Nothing you were
          working on is lost — drafts live in your browser and are still in the
          Notebook.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-6 py-3 font-sans text-[15px] hover:bg-ink/90 transition-colors"
          >
            Back home
            <span className="text-highlight">→</span>
          </Link>
          <Link
            href="/play"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Browse playgrounds →
          </Link>
        </div>
      </section>
    </Shell>
  );
}
