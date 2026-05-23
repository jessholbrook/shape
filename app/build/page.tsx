import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { STUDIOS, type Studio } from "@/lib/studio";

export const metadata = {
  title: "Build — Shape",
  description:
    "Studios. Longer guided projects that produce a portfolio-grade case study.",
};

export default function BuildPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Build">03</SectionNumber>

        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink mt-8 max-w-4xl">
          Longer projects. <span className="italic">Portfolio pieces.</span>
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-2xl">
          Studios are end-to-end guided projects. You frame the brief, design
          the assistant, test it, and reflect — and walk out with a case study
          you can paste into a portfolio.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-5">
          {STUDIOS.map((s) => (
            <StudioCard key={s.id} studio={s} />
          ))}
          <ComingSoonCard />
        </div>
      </section>
    </Shell>
  );
}

function StudioCard({ studio }: { studio: Studio }) {
  const ready = studio.status === "ready";
  const inner = (
    <div
      className={`relative bg-surface border border-line rounded-[16px] p-6 md:p-8 h-full transition-shadow ${
        ready
          ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
          : "opacity-70"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
          {studio.num}
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 ${
            ready
              ? "bg-highlight-soft text-highlight-ink"
              : "bg-line/60 text-ink-quiet"
          }`}
        >
          {ready ? "Open" : "Soon"}
        </span>
      </div>

      <h2 className="font-display text-[36px] md:text-[44px] leading-[1.05] tracking-tight text-ink mt-6">
        {studio.title}
        {studio.italic && (
          <>
            {" "}
            <span className="italic">{studio.italic}</span>
          </>
        )}
      </h2>

      <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-4 max-w-md">
        {studio.longBlurb}
      </p>

      <div className="mt-6 pt-4 border-t border-line flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        <span>
          Produces — <span className="text-ink-muted">{studio.artifact}</span>
        </span>
        <span>{studio.estMinutes} min</span>
        {ready && (
          <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors ml-auto">
            Open →
          </span>
        )}
      </div>
    </div>
  );

  if (!ready) return inner;
  return (
    <Link href={studio.href} className="group block">
      {inner}
    </Link>
  );
}

function ComingSoonCard() {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8 hatched flex flex-col">
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
        02
      </span>
      <h2 className="font-display text-[36px] md:text-[44px] leading-[1.05] tracking-tight text-ink mt-6">
        More studios <span className="italic">coming</span>
      </h2>
      <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-4 max-w-md">
        Onboarding flows, support copilots, evaluation-heavy projects. Each
        Studio is one full portfolio case study end-to-end.
      </p>
      <div className="mt-auto pt-6 border-t border-line font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Want one in particular? Open an issue.
      </div>
    </div>
  );
}
