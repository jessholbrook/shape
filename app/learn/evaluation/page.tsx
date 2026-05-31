import { Shell } from "@/components/shell";
import { getModule, nextModule } from "@/lib/curriculum";
import {
  ArticleHeader,
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
import { MarkAsRead } from "@/components/learn/mark-as-read";

const SLUG = "evaluation";

export const metadata = {
  title: "Evaluation",
  description:
    "A rubric makes good behavior something you can build, not something you sense.",
};

export default function EvaluationPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

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
        <ExampleBlock>
          <ExampleCard
            label="Vague rubric"
            promptLabel="Rubric"
            prompt={`"Write good empty-state copy."`}
            outputLabel="What you can say"
            output="Was it clear? I guess? Did it match the brand voice? Sort of. Actionable? Maybe."
            note="Every grader scores it differently because the criteria are still in their heads. You can't iterate against this."
          />
          <ExampleCard
            label="Specific rubric"
            promptLabel="Rubric"
            prompt={`Clarity — easy on first read, no ambiguity.
Tone — warm without sliding into chirpy.
Actionability — user knows what to do next.
Each scored 1-5.`}
            outputLabel="What you can say"
            output="Clarity 5. Tone 3 (a hair too enthusiastic). Actionability 4. Total 12/15."
            note="The 3 on tone is the design surface. You know exactly where to push next."
          />
        </ExampleBlock>
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

        <TryItCTA
          href={mod.playground?.href ?? "/play/evals"}
          buttonLabel="Open Eval Workshop"
        >
          Run the Eval Workshop and{" "}
          <span className="italic">move one criterion</span>.
        </TryItCTA>

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

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
