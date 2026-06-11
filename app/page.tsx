import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import {
  DiffPreview,
  PersonaPreview,
  TonePreview,
} from "@/components/home/playground-previews";

export default function Home() {
  return (
    <Shell>
      {/* HERO */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-24 pb-16 md:pb-20">
        <SectionNumber label="The pitch">01</SectionNumber>

        <h1 className="font-display text-[64px] sm:text-[88px] md:text-[120px] leading-[0.95] tracking-tight text-ink mt-8 max-w-5xl">
          Shape <span className="italic">model</span> behavior.
        </h1>

        <p className="font-sans text-[18px] md:text-[22px] leading-[1.5] text-ink-muted mt-8 max-w-2xl">
          A playground for people in UX — designers, researchers, writers,
          prototypers — to learn how to shape AI model behaviors. Learn by
          doing. Create artifacts you can use later.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/start"
            className="group inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-6 py-3 font-sans text-[15px] hover:gap-3 transition-all"
          >
            Start shaping
            <span className="text-highlight transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href="/play"
            className="inline-flex items-center gap-2 border border-ink text-ink rounded-[12px] px-6 py-3 font-sans text-[15px] hover:bg-ink hover:text-canvas transition-colors"
          >
            Browse playgrounds
          </Link>
        </div>

        <p className="mt-10 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet max-w-md">
          Free in your browser —{" "}
          <span className="text-ink">no key needed to start.</span>
        </p>
      </section>

      <Divider />

      {/* BRIDGE */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-12 md:py-16">
        <SectionNumber label="The frame">02</SectionNumber>
        <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6 max-w-3xl">
          You already think like a behavior designer.
        </h2>
        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-5 max-w-2xl">
          The skills you use every day are the foundation of shaping AI.
          This site helps you make the connections and try it out.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <BridgeCard
            kicker="You define personas."
            statement="Now design one for the model itself."
            chip="/play/persona"
            href="/play/persona"
          />
          <BridgeCard
            kicker="You write microcopy."
            statement="Now write the system prompt that produces it."
            chip="/play/tone"
            href="/play/tone"
          />
          <BridgeCard
            kicker="You run A/B tests."
            statement="Now diff two prompts side-by-side."
            chip="/play/diff"
            href="/play/diff"
          />
        </div>
      </section>

      <Divider />

      {/* FEATURED PLAYGROUNDS */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-12 md:py-16">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <SectionNumber label="Playgrounds">03</SectionNumber>
            <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6 max-w-3xl">
              Play and learn.
            </h2>
          </div>
          <Link
            href="/play"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            See all →
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
          <PlaygroundCard
            num="01"
            href="/play/diff"
            title="Diff"
            italic="mode"
            blurb="One prompt, two configs, side by side. Feel how prompts shape outputs."
            artifact="Diff Log"
            preview={<DiffPreview />}
          />
          <PlaygroundCard
            num="02"
            href="/play/tone"
            title="Tone"
            italic="dial"
            blurb="Style as a design token. Move dials, watch the prompt rewrite itself."
            artifact="Behavior Spec"
            preview={<TonePreview />}
          />
          <PlaygroundCard
            num="03"
            href="/play/persona"
            title="Persona"
            italic="workshop"
            blurb="Character design for AI. Build a backstory, voice, and blind spots."
            artifact="Persona Card"
            preview={<PersonaPreview />}
          />
        </div>
      </section>

      <Divider />

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-12 md:py-16">
        <SectionNumber label="How it works">04</SectionNumber>
        <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6 max-w-3xl">
          Three steps to get going.
        </h2>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard
            num="01"
            title="Start free."
            body="A small open model runs right in your browser — no key required. Bring an Anthropic or OpenAI key when you want bigger models."
          />
          <StepCard
            num="02"
            title="Shape something."
            body="Open a playground. Tune a tone, design a persona, diff two prompts."
          />
          <StepCard
            num="03"
            title="Save it to your notebook."
            body="Every draft persists locally — reopen, duplicate, export as JSON."
          />
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

function BridgeCard({
  kicker,
  statement,
  chip,
  href,
}: {
  kicker: string;
  statement: string;
  chip: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-surface border border-line rounded-[16px] p-6 md:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center font-mono text-[12px] bg-highlight-soft text-highlight-ink rounded-full px-3 py-1">
          {chip}
        </span>
        <span className="font-mono text-[12px] text-ink-quiet group-hover:text-highlight transition-colors">
          →
        </span>
      </div>
      <p className="font-display text-[22px] md:text-[26px] leading-[1.2] text-ink mt-6">
        <span className="text-ink-quiet">{kicker}</span>{" "}
        <span className="italic">{statement}</span>
      </p>
    </Link>
  );
}

function PlaygroundCard({
  num,
  href,
  title,
  italic,
  blurb,
  artifact,
  preview,
}: {
  num: string;
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
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
          {num}
        </span>
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

function StepCard({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet">
        {num}
      </div>
      <h3 className="font-display text-[26px] md:text-[28px] leading-[1.15] text-ink mt-4">
        {title}
      </h3>
      <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-4">
        {body}
      </p>
    </div>
  );
}
