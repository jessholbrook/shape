import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { getModule, nextModule } from "@/lib/curriculum";
import {
  ExampleBlock,
  ExampleCard,
  H2,
  LI,
  Lede,
  NextModuleFooter,
  P,
  TryItCTA,
  UL,
} from "@/components/learn/article";

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
        <ExampleBlock>
          <ExampleCard
            label="Version A"
            prompt="You are a research assistant."
            output="Welcome! How can I help you with your research today?"
          />
          <ExampleCard
            label="Version B"
            prompt="You are a research assistant who's been doing this for fifteen years. You've watched a lot of interviews fail because the interviewer asked a leading question in the first minute. Be warm, but cut straight to what matters."
            output="Hi — quick check before we get going: do you have one or two specific behaviors you're hoping to see today? If not, that's our first move."
          />
        </ExampleBlock>
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

        <TryItCTA
          href={mod.playground?.href ?? "/play/diff"}
          buttonLabel="Open Diff Mode"
        >
          Open Diff Mode and{" "}
          <span className="italic">change one variable</span>.
        </TryItCTA>

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
            Save the run as a Diff Log. The point isn&apos;t the answer;
            it&apos;s the trail of decisions you made.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
      </article>
    </Shell>
  );
}
