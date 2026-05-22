import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";

export default function Home() {
  return (
    <Shell>
      {/* HERO */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-24 pb-32 md:pb-40">
        <SectionNumber label="The pitch">01</SectionNumber>

        <h1 className="font-display text-[64px] sm:text-[88px] md:text-[120px] leading-[0.95] tracking-tight text-ink mt-8 max-w-5xl">
          Shape <span className="italic">model</span> behavior.
        </h1>

        <p className="font-sans text-[18px] md:text-[22px] leading-[1.5] text-ink-muted mt-10 max-w-2xl">
          The behavior design playground for UX designers and researchers.
          Learn the craft. Build a portfolio.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-4">
          <a
            href="/start"
            className="group inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-6 py-3 font-sans text-[15px] hover:gap-3 transition-all"
          >
            Start shaping
            <span className="text-highlight transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
          <a
            href="/gallery"
            className="inline-flex items-center gap-2 border border-ink text-ink rounded-[12px] px-6 py-3 font-sans text-[15px] hover:bg-ink hover:text-canvas transition-colors"
          >
            See the gallery
          </a>
        </div>

        <p className="mt-16 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet max-w-md">
          Bring your own key —{" "}
          <span className="text-ink">stays in your browser, never ours.</span>
        </p>
      </section>

      <Divider />

      {/* BRIDGE */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-24 md:py-32">
        <SectionNumber label="The frame">02</SectionNumber>
        <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-8 max-w-3xl">
          You already think like a behavior designer.
        </h2>
        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-6 max-w-2xl">
          The skills you use every day are the foundation of shaping AI.
          Shape just gives them somewhere to land.
        </p>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <BridgeCard
            kicker="You define personas."
            statement="Now design one for the model itself."
            chip="/persona"
          />
          <BridgeCard
            kicker="You write microcopy."
            statement="Now write the system prompt that produces it."
            chip="/system"
          />
          <BridgeCard
            kicker="You run usability studies."
            statement="Now run evaluations on AI behavior."
            chip="/evals"
          />
        </div>
      </section>

      <Divider />

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-24 md:py-32">
        <SectionNumber label="How it works">03</SectionNumber>
        <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-8 max-w-3xl">
          Three steps to a portfolio piece.
        </h2>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <StepCard
            num="01"
            title="Bring your key."
            body="Plug in an Anthropic or OpenAI key. It stays in your browser — we never see it."
          />
          <StepCard
            num="02"
            title="Shape something."
            body="Open a playground. Tune a tone, design a persona, diff two prompts, or run a refusal test."
          />
          <StepCard
            num="03"
            title="Publish a case study."
            body="Every artifact gets a public URL, a live demo, and a PDF export. Add it to your portfolio."
          />
        </div>
      </section>

      {/* Bottom breathing room so floating nav doesn't sit on content */}
      <div className="h-40" />
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
}: {
  kicker: string;
  statement: string;
  chip: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="inline-flex items-center font-mono text-[12px] bg-highlight-soft text-highlight-ink rounded-full px-3 py-1">
        {chip}
      </div>
      <p className="font-display text-[22px] md:text-[26px] leading-[1.2] text-ink mt-6">
        <span className="text-ink-quiet">{kicker}</span>{" "}
        <span className="italic">{statement}</span>
      </p>
    </div>
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
