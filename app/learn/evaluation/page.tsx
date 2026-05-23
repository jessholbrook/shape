import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { getModule, nextModule } from "@/lib/curriculum";

const SLUG = "evaluation";

export const metadata = {
  title: "Evaluation — Shape",
  description:
    "A rubric makes good behavior something you can build, not something you sense.",
};

export default function EvaluationPage() {
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
          <span className="italic">Evaluation</span>.
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
          A rubric makes good behavior something you can build, not
          something you sense. Once it&apos;s on the page, you can argue
          with it — and so can the rest of your team.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          You&apos;ve run a usability study. You wrote task scenarios,
          decided what success looked like before the sessions started,
          and graded each participant against a rubric. Maybe it was
          numeric (completion in under 90 seconds), maybe it was thematic
          (did they need to back out and start over?). Either way, the
          rubric existed before the data, which is the whole reason it
          works.
        </P>
        <P>
          Evaluation on a language model is the same move, applied to a
          different surface. You&apos;re not asking &ldquo;was the
          output good?&rdquo; — too vague to ever settle. You&apos;re
          asking &ldquo;was it clear, concise, on-tone, actionable?&rdquo;
          One question, four dials, each scorable on its own.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          Without a rubric, every output gets graded against a moving
          target. The reader squints, says &ldquo;hmm, not quite,&rdquo;
          and rewrites the prompt without knowing what they were trying
          to improve. With a rubric, the squinting becomes a specific
          claim: &ldquo;tone dropped from 4 to 2 when I added the
          formality rule.&rdquo; That&apos;s the difference between
          tweaking and designing.
        </P>
        <P>
          The rubric is the artifact. The scores are the receipt.
        </P>

        <H2>A small example</H2>
        <ExampleBlock
          aLabel="Vague rubric"
          aPrompt={`"Write good empty-state copy."`}
          aOutput="Was it clear? I guess? Did it match the brand voice? Sort of. Actionable? Maybe."
          aNote="Every grader scores it differently because the criteria are still in their heads. You can't iterate against this."
          bLabel="Specific rubric"
          bPrompt={`Clarity — easy on first read, no ambiguity.
Tone — warm without sliding into chirpy.
Actionability — user knows what to do next.
Each scored 1-5.`}
          bOutput="Clarity 5. Tone 3 (a hair too enthusiastic). Actionability 4. Total 12/15."
          bNote="The 3 on tone is the design surface. You know exactly where to push next."
        />
        <P>
          Same output, two rubrics, different conversations. The first
          ends in a shrug. The second ends in a list of things to try.
        </P>

        <H2>Why this is the foundation</H2>
        <P>
          Once you have a rubric, every other design move gets cheaper.
          Comparing two prompts? Run both against the rubric and look at
          the deltas. Comparing models? Same. Convincing a stakeholder
          that v3 is better than v2? Show them the scorecard. The rubric
          is what turns &ldquo;trust me, it&apos;s better&rdquo; into
          something they can read.
        </P>
        <P>
          Three things to watch for when you write one:
        </P>
        <UL>
          <LI>
            <strong>Criteria that aren&apos;t criteria.</strong>{" "}
            &ldquo;Good&rdquo; isn&apos;t a criterion. Neither is{" "}
            &ldquo;sounds AI-generated.&rdquo; Replace with the specific
            quality you mean.
          </LI>
          <LI>
            <strong>Overlap.</strong> If two criteria almost always
            move together, you&apos;ve written one criterion twice.
            Merge them.
          </LI>
          <LI>
            <strong>Missing the boring middle.</strong> Most outputs
            aren&apos;t terrible or excellent — they&apos;re 3s. A 1-5
            scale captures the middle. Pass/fail doesn&apos;t.
          </LI>
        </UL>

        <TryItCTA href={mod.playground?.href ?? "/play/evals"} />

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start with the seeded rubric. Run the cases without changing
            anything. Score honestly. You&apos;re calibrating.
          </LI>
          <LI>
            Pick the criterion where the model scored worst across cases.
            Tweak the system prompt to push that one number up.
          </LI>
          <LI>
            Rerun. If the target criterion moved up but another moved
            down, you found a real trade-off — write a note about it.
            That&apos;s the artifact.
          </LI>
          <LI>
            If every score went up, the rubric is probably too easy.
            Tighten a criterion description until you can score honestly
            again.
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
    <ul className="mt-6 flex flex-col gap-3 max-w-prose">{children}</ul>
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
  aNote,
  bLabel,
  bPrompt,
  bOutput,
  bNote,
}: {
  aLabel: string;
  aPrompt: string;
  aOutput: string;
  aNote: string;
  bLabel: string;
  bPrompt: string;
  bOutput: string;
  bNote: string;
}) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <ExampleCard
        label={aLabel}
        prompt={aPrompt}
        output={aOutput}
        note={aNote}
      />
      <ExampleCard
        label={bLabel}
        prompt={bPrompt}
        output={bOutput}
        note={bNote}
      />
    </div>
  );
}

function ExampleCard({
  label,
  prompt,
  output,
  note,
}: {
  label: string;
  prompt: string;
  output: string;
  note: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-5 flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          Rubric
        </p>
        <p className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
      <div className="border-t border-line pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          What you can say
        </p>
        <p className="font-sans text-[13px] leading-[1.55] text-ink italic">
          &ldquo;{output}&rdquo;
        </p>
      </div>
      <div className="border-t border-line pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          Read
        </p>
        <p className="font-sans text-[12px] leading-[1.55] text-ink-muted">
          {note}
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
          Run the Eval Workshop and{" "}
          <span className="italic">move one criterion</span>.
        </h3>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-5 py-3 font-sans text-[14px] hover:bg-ink/90 transition-colors"
      >
        Open Eval Workshop
        <span className="text-highlight">→</span>
      </Link>
    </div>
  );
}
