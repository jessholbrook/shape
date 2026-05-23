import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { getModule, nextModule } from "@/lib/curriculum";

const SLUG = "prompts-as-design";

export const metadata = {
  title: "Prompts as design — Shape",
  description:
    "A prompt is a design variable. Treat it like a brand-voice swatch, not a magic spell.",
};

export default function PromptsAsDesignPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <Link
          href="/learn"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          ← Learn
        </Link>

        <div className="mt-10">
          <SectionNumber label={`Module ${mod.num}`}>{mod.num}</SectionNumber>
        </div>

        <h1 className="font-display text-[56px] md:text-[80px] leading-[0.98] tracking-tight text-ink mt-6">
          Prompts <span className="italic">as design</span>.
        </h1>

        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {mod.readMinutes} min read · pairs with{" "}
          <Link
            href={mod.playground?.href ?? "/play"}
            className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            {mod.playground?.label}
          </Link>
        </p>

        <Lede>
          A prompt is a design variable, not a magic spell. Once you see it
          that way, most of the &ldquo;prompt engineering&rdquo; folklore
          starts to feel familiar — because you already do this work, just
          with different inputs.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          When you write a tooltip, you don&apos;t hand the engineer a
          paragraph and hope. You write a brand-voice document, decide on a
          tone (warm but not cute, direct but not curt), then craft the copy
          to match. The brand-voice doc is the persistent style; the tooltip
          is the call site.
        </P>
        <P>
          The system prompt is the brand-voice doc for the model. The user
          message is the call site. Same architecture — different surface.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          Every word in a system prompt is a design decision. &ldquo;Be
          concise&rdquo; and &ldquo;Be brief&rdquo; are different style
          choices. &ldquo;You are a research assistant&rdquo; and &ldquo;You
          are an experienced research assistant who works with first-time
          interviewers&rdquo; produce different outputs.
        </P>
        <P>
          When you treat the prompt as a design variable, the work becomes
          recognizably yours: write a version, run it, look at the output,
          notice what you don&apos;t like, change one thing, run it again.
          That&apos;s iteration, not incantation.
        </P>

        <H2>A small example</H2>
        <ExampleBlock
          aLabel="Version A"
          aPrompt="You are a research assistant."
          aOutput={`Welcome! How can I help you with your research today?`}
          bLabel="Version B"
          bPrompt="You are a research assistant who's been doing this for fifteen years. You've watched a lot of interviews fail because the interviewer asked a leading question in the first minute. Be warm, but cut straight to what matters."
          bOutput={`Hi — quick check before we get going: do you have one or two specific behaviors you're hoping to see today? If not, that's our first move.`}
        />
        <P>
          Same task. Same model. Different prompt, different behavior. You
          didn&apos;t need to know anything about transformers or tokens to
          see why Version B is more useful — you read the two outputs and
          one felt right.
        </P>

        <H2>Why this is the foundation</H2>
        <P>
          Behavior design is mostly small loops. Write a version, watch the
          model behave, notice the gap between what you wanted and what you
          got, change one thing. The size of the loop matters: the smaller
          and faster, the more design you do.
        </P>
        <P>
          Diff Mode shrinks the loop. Two configs, one user message, both
          outputs side-by-side. You stop debating Version A vs Version B in
          your head and start seeing them.
        </P>

        <TryItCTA href={mod.playground?.href ?? "/play/diff"} />

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start with a prompt you&apos;ve actually written before — a
            microcopy guideline, a voice doc, a brief. Don&apos;t invent.
          </LI>
          <LI>
            Change <em>one variable per run</em>. Two variables and you
            won&apos;t know which one moved the output.
          </LI>
          <LI>
            Save the run as a Diff Log. The point isn&apos;t the answer; it&apos;s
            the trail of decisions you made.
          </LI>
        </UL>

        {next && (
          <div className="mt-20 pt-8 border-t border-line">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Next module
            </p>
            <Link
              href={next.href !== "#" ? next.href : "/learn"}
              className="mt-3 inline-flex items-baseline gap-3 group"
            >
              <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-quiet">
                {next.num}
              </span>
              <span className="font-display text-[24px] md:text-[28px] leading-[1.15] text-ink group-hover:text-highlight-ink transition-colors">
                {next.title}
                {next.italic && (
                  <>
                    {" "}
                    <span className="italic">{next.italic}</span>
                  </>
                )}
              </span>
              {next.status === "soon" && (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet bg-line/60 rounded-full px-2 py-0.5">
                  Soon
                </span>
              )}
            </Link>
          </div>
        )}
      </article>
    </Shell>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[24px] md:text-[28px] leading-[1.4] text-ink mt-12 italic">
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[28px] md:text-[34px] leading-[1.15] tracking-tight text-ink mt-16">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[17px] leading-[1.65] text-ink mt-6 max-w-prose">
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-6 flex flex-col gap-3 max-w-prose">
      {children}
    </ul>
  );
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="font-sans text-[16px] leading-[1.6] text-ink pl-5 relative">
      <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-highlight" />
      {children}
    </li>
  );
}

function ExampleBlock({
  aLabel,
  aPrompt,
  aOutput,
  bLabel,
  bPrompt,
  bOutput,
}: {
  aLabel: string;
  aPrompt: string;
  aOutput: string;
  bLabel: string;
  bPrompt: string;
  bOutput: string;
}) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <ExampleCard label={aLabel} prompt={aPrompt} output={aOutput} />
      <ExampleCard label={bLabel} prompt={bPrompt} output={bOutput} />
    </div>
  );
}

function ExampleCard({
  label,
  prompt,
  output,
}: {
  label: string;
  prompt: string;
  output: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-5 flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          System prompt
        </p>
        <p className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
      <div className="border-t border-line pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          Output
        </p>
        <p className="font-sans text-[13px] leading-[1.55] text-ink italic">
          &ldquo;{output}&rdquo;
        </p>
      </div>
    </div>
  );
}

function TryItCTA({ href }: { href: string }) {
  return (
    <div className="mt-10 bg-surface border border-line rounded-[16px] p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Try it in the playground
        </p>
        <h3 className="font-display text-[22px] leading-[1.15] text-ink mt-2">
          Open Diff Mode and{" "}
          <span className="italic">change one variable</span>.
        </h3>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-5 py-3 font-sans text-[14px] hover:bg-ink/90 transition-colors"
      >
        Open Diff Mode
        <span className="text-highlight">→</span>
      </Link>
    </div>
  );
}
