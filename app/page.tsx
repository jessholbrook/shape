import Link from "next/link";
import { Shell } from "@/components/shell";
import {
  DiffPreview,
  PersonaPreview,
  TonePreview,
} from "@/components/home/playground-previews";
import { LearningPaths } from "@/components/home/learning-paths";
import { LuckyCard } from "@/components/home/path-previews";
import { CORE } from "@/lib/lenses";

export default function Home() {
  return (
    <Shell>
      {/* HERO */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-24 pb-16 md:pb-20">
        <h1 className="font-display text-[64px] sm:text-[88px] md:text-[120px] leading-[0.95] tracking-tight text-ink max-w-5xl">
          Shape <span className="italic">model</span> behavior
        </h1>

        <p className="font-sans text-[18px] md:text-[22px] leading-[1.5] text-ink-muted mt-8 max-w-2xl">
          {CORE.hero.lede}
        </p>

        <div className="mt-10">
          <LearningPaths />
        </div>
      </section>

      <Divider />

      {/* FEATURED PLAYGROUNDS */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-12 md:py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink max-w-3xl">
              Popular <span className="italic">playgrounds</span>
            </h2>
          </div>
          <Link
            href="/play"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            See all →
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
          <PlaygroundCard
            href="/play/diff"
            title="Diff"
            italic="mode"
            blurb="One prompt, two configs, side by side. Feel how prompts shape outputs."
            artifact="Diff Log"
            preview={<DiffPreview />}
          />
          <PlaygroundCard
            href="/play/tone"
            title="Tone"
            italic="dial"
            blurb="Style as a design token. Move dials, watch the prompt rewrite itself."
            artifact="Behavior Spec"
            preview={<TonePreview />}
          />
          <PlaygroundCard
            href="/play/persona"
            title="Persona"
            italic="workshop"
            blurb="Character design for AI. Build a backstory, voice, and blind spots."
            artifact="Persona Card"
            preview={<PersonaPreview />}
          />
          <LuckyCard />
        </div>
      </section>

      {/* Bottom breathing room so floating nav doesn't sit on content */}
      <div className="h-20" />
    </Shell>
  );
}

function Divider() {
  return (
    <div className="mx-auto max-w-[1280px] px-6 md:px-12">
      <div className="border-t border-line" />
    </div>
  );
}

function PlaygroundCard({
  href,
  title,
  italic,
  blurb,
  artifact,
  preview,
}: {
  href: string;
  title: string;
  italic: string;
  blurb: string;
  artifact: string;
  preview?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block bg-surface border border-line rounded-[16px] p-6 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex items-center justify-end">
        <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
          Open →
        </span>
      </div>
      <h3 className="font-display text-[28px] md:text-[34px] leading-[1.1] tracking-tight text-ink mt-6">
        {title} <span className="italic">{italic}</span>
      </h3>
      {preview && <div className="mt-4">{preview}</div>}
      <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">
        {blurb}
      </p>
      <div className="mt-5 pt-4 border-t border-line">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Produces —{" "}
          <span className="text-ink-muted">{artifact}</span>
        </span>
      </div>
    </Link>
  );
}
