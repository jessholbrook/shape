import Link from "next/link";
import { Shell } from "@/components/shell";
import { PLAYGROUNDS, type Playground } from "@/lib/playgrounds";

export const metadata = {
  title: "Play",
  description:
    "Small, focused playgrounds for shaping AI behavior. Diff prompts, tune tone, design personas.",
};

export default function PlayPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink max-w-4xl">
          Play to <span className="italic">learn</span>
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-2xl">
          Playgrounds are small, focused tools that isolate one design lever at
          a time. Each one produces an artifact you can download.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-5">
          {PLAYGROUNDS.map((p) => (
            <PlaygroundCard key={p.num} {...p} />
          ))}
        </div>
      </section>
    </Shell>
  );
}

function PlaygroundCard({
  href,
  title,
  italic,
  blurb,
  artifact,
  status,
  concept,
}: Playground) {
  const ready = status === "ready";
  const inner = (
    <div
      className={`relative bg-surface border border-line rounded-[16px] p-6 md:p-8 h-full transition-shadow ${
        ready
          ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
          : "opacity-70"
      }`}
    >
      {/* No numbers: playgrounds aren't a sequence (see DESIGN.md, Sequence numerals). */}
      <div className="flex items-center justify-end">
        {ready ? (
          <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">Open →</span>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 bg-line/60 text-ink-quiet">
            Soon
          </span>
        )}
      </div>

      <h2 className="font-display text-[36px] md:text-[44px] leading-[1.05] tracking-tight text-ink mt-6">
        {title} <span className="italic">{italic}</span>
      </h2>

      <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-4 max-w-md">
        {blurb}
      </p>

      <div className="mt-6">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Produces — <span className="text-ink-muted">{artifact}</span>
          {concept && (
            <>
              {" · "}Concept —{" "}
              <span className="text-ink-muted">{concept.label}</span>
            </>
          )}
        </span>
      </div>
    </div>
  );

  if (!ready) return inner;
  return (
    <Link href={href} className="group block">
      {inner}
    </Link>
  );
}
