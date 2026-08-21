import { Shell } from "@/components/shell";
import { getModule, moduleMetadata, nextModule } from "@/lib/curriculum";
import {
  ArticleHeader,
  ExampleBlock,
  ExampleCard,
  H2,
  LI,
  Lede,
  NextModuleFooter,
  NoteAccent,
  P,
  TryItCTA,
  UL,
} from "@/components/learn/article";
import { MarkAsRead } from "@/components/learn/mark-as-read";

const SLUG = "distributions-not-outputs";

export const metadata = moduleMetadata(SLUG);

export default function DistributionsPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          You have never seen what your prompt does. You have seen one
          sample of it, once, and decided that was the thing.
        </Lede>

        <H2>What you already know</H2>
        <P>
          You would never ship a flow after watching one participant. One
          session is an anecdote. You run five, or eight, and you look for
          what repeats — because the thing you care about isn&apos;t what
          happened in that room, it&apos;s what tends to happen. The single
          session is still useful; you just don&apos;t mistake it for the
          finding.
        </P>
        <P>
          You already have that instinct. You have never pointed it at a
          prompt.
        </P>
        <P>
          And nothing has encouraged you to. Every playground on this site
          — Diff Mode, Tone Dial, Persona Lab — shows you one output per
          run. That&apos;s a fine way to learn a lever, and it quietly
          trains exactly the habit you&apos;d never accept from a research
          plan: judging a design by its most recent sample.
        </P>

        <H2>What a model actually gives you</H2>
        <P>
          A language model doesn&apos;t compute an answer. It samples one,
          from a distribution over many possible answers, and then throws
          the rest away. Run it again and you get a different draw from the
          same distribution. Temperature is the width of that distribution
          — not a weirdness knob, a spread control.
        </P>
        <P>
          So the honest unit of your work isn&apos;t the output. It&apos;s
          the spread. And a clause in your system prompt isn&apos;t
          &ldquo;working&rdquo; or &ldquo;not working&rdquo; — it holds
          some percentage of the time.
        </P>

        <H2>The lesson</H2>
        <P>
          Here is the part that matters, and it is not the part people
          expect.
        </P>
        <P>
          A rule that fails <em>every</em>{" "}
          time is not your problem. You
          notice it on the first run and you fix it. The dangerous clause
          is the one that fails one run in ten — it passes your spot check,
          it passes the demo, it passes review, and then it ships and fails
          for a stranger. Intermittent failures are worse than consistent
          ones precisely because consistent ones get caught.
        </P>
        <P>
          Testing once can only ever find the consistent kind. That is the
          whole argument for running the same prompt ten times: not to be
          rigorous for its own sake, but because the failures worth finding
          are invisible at n=1.
        </P>
        <P>
          It also changes how you read everything else you&apos;ve built
          here. Two prompts compared in Diff Mode, one output each, is two
          coin flips next to each other. Sometimes the difference you see
          is the prompt. Sometimes it&apos;s the draw.
        </P>

        <H2>Not everything wobbles equally</H2>
        <P>
          Once you start looking at spread, you find the variance is
          lopsided in a useful way:
        </P>
        <UL>
          <LI>
            <strong>Structure mostly holds.</strong>{" "}
            Ask for three bullets
            and you tend to get three bullets. Format instructions are
            among the most reliable things you can write.
          </LI>
          <LI>
            <strong>Length caps mostly hold</strong>, though they drift
            upward — &ldquo;one sentence&rdquo; becomes a long sentence
            before it becomes two.
          </LI>
          <LI>
            <strong>Prohibitions wobble the most.</strong>{" "}
            &ldquo;Never say X&rdquo; is the classic intermittent clause.
            It holds until the sentence the model wants to write happens to
            want X, and then it doesn&apos;t.
          </LI>
          <LI>
            <strong>Tone wobbles quietly.</strong>{" "}
            Not enough to fail a
            check, enough that a careful reader notices the fourth one
            sounds like a different writer.
          </LI>
        </UL>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="One run"
            promptLabel="System prompt"
            prompt={`You are a UX writer. Warm, plain microcopy.
No exclamation marks.`}
            outputLabel="Output"
            output="Welcome — let's set up your first research interview."
            note={
              <>
                Clean. On brand. Follows the rule.{" "}
                <NoteAccent>You would ship this.</NoteAccent>
              </>
            }
          />
          <ExampleCard
            label="The same prompt, ten times"
            promptLabel="System prompt"
            prompt={`You are a UX writer. Warm, plain microcopy.
No exclamation marks.`}
            outputLabel="What actually came back"
            output="Six without an exclamation mark. Four with one."
            note={
              <>
                The prompt didn&apos;t change and the model didn&apos;t get
                worse.{" "}
                <NoteAccent>
                  Only your confidence was wrong.
                </NoteAccent>{" "}
                That clause holds 60% of the time, and you had no way to
                know that from the run you looked at.
              </>
            }
          />
        </ExampleBlock>
        <P>
          &ldquo;No exclamation marks&rdquo; is about as explicit as an
          instruction gets. It still only mostly works. That gap — between
          what you wrote down and what actually happens — is the thing this
          module is about, and you can only see it by looking more than
          once.
        </P>

        <H2>Turning a feeling into a number</H2>
        <P>
          The move is the same one you made in{" "}
          <em>Evaluation</em>: write the criterion down before you look.
          Take each line of your behavior spec and turn it into something
          checkable — under 30 words, mentions the product name, no
          exclamation marks — then score it across every run as a hit rate
          rather than a verdict.
        </P>
        <P>
          &ldquo;Your spec held on 3 of 5 clauses&rdquo; is a different
          kind of sentence than &ldquo;this looks good.&rdquo; You can act
          on it, argue with it, and check it again after you edit.
        </P>
        <P>
          Two honest limits. Checks like these catch{" "}
          <em>mechanical</em>{" "}
          drift — length, forbidden words, required
          mentions — and say nothing about tone; for that you still have to
          read the outliers yourself. And a hit rate over ten runs is an
          estimate, not a measurement: 6 out of 10 means &ldquo;roughly
          half the time,&rdquo; not 60.0%. It&apos;s enough to tell a coin
          flip from a rule, which is all you need it to do.
        </P>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Run the seeded example first, unchanged. One of the three
            clauses is written to fail intermittently. Find out which
            before you read on.
          </LI>
          <LI>
            Now bring your own — paste in a system prompt you already
            trust from Tone Dial or Persona Lab, and write assertions for
            the three things you&apos;d swear it always does.
          </LI>
          <LI>
            Expect one of them to be a coin flip. That clause is the
            finding, and it&apos;s the one to rewrite.
          </LI>
          <LI>
            Rewrite it, rerun, and watch the hit rate rather than the
            output. Going from 6/10 to 9/10 is real progress even though
            no single run looks different.
          </LI>
          <LI>
            Read the outlier — the run furthest from the median. Assertions
            can&apos;t see tone, and the outlier is where tone drift shows
            up.
          </LI>
        </UL>

        <TryItCTA
          href={mod.playground?.href ?? "/play/spread"}
          buttonLabel="Open Spread"
        >
          Run one prompt ten times and{" "}
          <span className="italic">watch a clause fail</span>.
        </TryItCTA>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
