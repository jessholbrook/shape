import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { MODULES, type CurriculumModule } from "@/lib/curriculum";

export const metadata = {
  title: "Learn — Shape",
  description:
    "Eight modules from Behavior Designer 101 to 301. Concept articles paired with playgrounds.",
};

export default function LearnPage() {
  const totalReady = MODULES.filter((m) => m.status === "ready").length;

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

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {totalReady} of {MODULES.length} modules live ·{" "}
          <span className="text-ink-muted">more landing soon</span>
        </p>

        <div className="mt-16 flex flex-col gap-3">
          {MODULES.map((m) => (
            <ModuleRow key={m.num} module={m} />
          ))}
        </div>
      </section>
    </Shell>
  );
}

function ModuleRow({ module: m }: { module: CurriculumModule }) {
  const ready = m.status === "ready";
  const inner = (
    <div
      className={`bg-surface border border-line rounded-[14px] p-5 md:p-6 transition-shadow ${
        ready
          ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)] group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
          : "opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            {m.num}
          </span>
          <div className="min-w-0">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {m.kicker}
              {m.readMinutes && (
                <>
                  {" · "}
                  <span>{m.readMinutes} min read</span>
                </>
              )}
            </span>
            <h2 className="font-display text-[26px] md:text-[30px] leading-[1.15] text-ink mt-1">
              {m.title}
              {m.italic && (
                <>
                  {" "}
                  <span className="italic">{m.italic}</span>
                </>
              )}
            </h2>
            <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-2 max-w-2xl">
              {m.blurb}
            </p>
          </div>
        </div>
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 shrink-0 ${
            ready
              ? "bg-highlight-soft text-highlight-ink"
              : "bg-line/60 text-ink-quiet"
          }`}
        >
          {ready ? "Open" : "Soon"}
        </span>
      </div>

      <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {m.playground && (
          <span>
            Playground —{" "}
            <span className="text-ink-muted">{m.playground.label}</span>
          </span>
        )}
        <span>
          Artifact — <span className="text-ink-muted">{m.artifact}</span>
        </span>
        {ready && (
          <span className="ml-auto font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
            Open →
          </span>
        )}
      </div>
    </div>
  );

  if (!ready) return inner;
  return (
    <Link href={m.href} className="group block">
      {inner}
    </Link>
  );
}
