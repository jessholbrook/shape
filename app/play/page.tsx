import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";

export const metadata = {
  title: "Play — Shape",
  description:
    "Small, focused playgrounds for shaping AI behavior. Diff prompts, tune tone, design personas.",
};

type Playground = {
  num: string;
  href: string;
  title: string;
  italic: string;
  blurb: string;
  artifact: string;
  status: "ready" | "soon";
};

const PLAYGROUNDS: Playground[] = [
  {
    num: "01",
    href: "/play/diff",
    title: "Diff",
    italic: "mode",
    blurb:
      "Run one prompt through two configurations side-by-side. The fastest way to feel how prompts shape outputs.",
    artifact: "Diff Log",
    status: "ready",
  },
  {
    num: "02",
    href: "/play/tone",
    title: "Tone",
    italic: "dial",
    blurb:
      "Treat style as a design token. Move dials for warmth, verbosity, energy, directness — see the prompt compose itself.",
    artifact: "Behavior Spec",
    status: "ready",
  },
  {
    num: "03",
    href: "#",
    title: "Persona",
    italic: "workshop",
    blurb:
      "Design a character — backstory, beliefs, blind spots — and watch the model embody them.",
    artifact: "Persona Card",
    status: "soon",
  },
  {
    num: "04",
    href: "#",
    title: "Refusal",
    italic: "lab",
    blurb:
      "Probe boundary design with a panel of edge cases. Tune the line between over- and under-refusal.",
    artifact: "Refusal Scorecard",
    status: "soon",
  },
];

export default function PlayPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Play">02</SectionNumber>

        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink mt-8 max-w-4xl">
          Small tools. <span className="italic">Sharp lessons.</span>
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-8 max-w-2xl">
          Playgrounds are small, focused tools that isolate one design lever at
          a time. Each one produces a portfolio artifact you can publish.
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
  num,
  href,
  title,
  italic,
  blurb,
  artifact,
  status,
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
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
          {num}
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
        {title} <span className="italic">{italic}</span>
      </h2>

      <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-4 max-w-md">
        {blurb}
      </p>

      <div className="mt-6 flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Produces — <span className="text-ink-muted">{artifact}</span>
        </span>
        {ready && (
          <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
            Open →
          </span>
        )}
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
