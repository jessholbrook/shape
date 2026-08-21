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

const SLUG = "judging-at-scale";

export const metadata = moduleMetadata(SLUG);

export default function JudgingPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          Scoring by hand stops working somewhere around the fiftieth output.
          Handing it to a model is the right instinct. Trusting what comes back
          is not.
        </Lede>

        <H2>What you already know</H2>
        <P>
          You have counterbalanced a study. Two prototypes, and you did not
          show them to every participant in the same order — half saw A first,
          half saw B — because you know perfectly well that whichever comes
          first has an advantage that has nothing to do with the design.
        </P>
        <P>
          Nobody taught you that as a special technique for AI. It is just what
          it means to run a comparison properly. An uncounterbalanced
          preference test isn&apos;t weak evidence, it&apos;s{" "}
          <em>not evidence</em>.
        </P>
        <P>
          A model asked to compare two answers is a participant. You have never
          counterbalanced it.
        </P>

        <H2>Why automate at all</H2>
        <P>
          Because the alternative doesn&apos;t scale, and pretending otherwise
          helps nobody. A rubric applied by hand across a dozen cases is a good
          afternoon&apos;s work. Across a thousand, on every release, it
          doesn&apos;t happen — which in practice means nothing gets evaluated
          at all.
        </P>
        <P>
          So automate. The mistake isn&apos;t automating; it&apos;s treating
          the output as a measurement before you have checked that the
          instrument measures anything.
        </P>

        <H2>The check</H2>
        <P>
          Run every comparison twice, with the two answers swapped.
        </P>
        <P>
          A judge reading <strong>quality</strong>{" "}
          picks the same answer both times. A judge reading{" "}
          <strong>position</strong>{" "}
          also gives you a consistent-looking result — it picks the same{" "}
          <em>slot</em>{" "}
          both times, which is a different answer. One swap tells those two
          apart, and nothing else does.
        </P>

        <H2>Why agreement is the wrong headline</H2>
        <P>
          This is the part worth slowing down for, because the number everyone
          reports is the one that means least.
        </P>
        <P>
          Say your judge agrees with your own picks on eight of ten pairs.
          Sounds like a working instrument. Now consider a judge that has
          learned nothing at all and simply always names the first answer. With
          two options it will be right about half the time by construction —
          and if your examples happen to list the better answer first more often
          than not, its agreement climbs, with no judgement involved anywhere.
        </P>
        <P>
          <NoteAccent>
            Agreement without consistency isn&apos;t a measurement.
          </NoteAccent>{" "}
          It&apos;s the rate at which two things coincided. Which is why the
          flip rate goes first, and the agreement number gets reported only
          over the pairs that held steady.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="As written"
            promptLabel="Order"
            prompt={`Answer 1 — "No projects yet."
Answer 2 — "It looks like you don't have
any projects at the moment!…"`}
            outputLabel="Verdict"
            output="The first is crisper and gets out of the way. WINNER: 1"
            note={<>Reasonable. It picked the short one.</>}
          />
          <ExampleCard
            label="Swapped"
            promptLabel="Order"
            prompt={`Answer 1 — "It looks like you don't have
any projects at the moment!…"
Answer 2 — "No projects yet."`}
            outputLabel="Verdict"
            output="The first is more helpful and sets context. WINNER: 1"
            note={
              <>
                Also reasonable, also confident, and the opposite answer.{" "}
                <NoteAccent>
                  It was reading the slot, not the copy.
                </NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          Neither reply looks like a failure. Both give a rationale. Read either
          one on its own and you would take it seriously — which is why the
          check has to be mechanical rather than a matter of noticing.
        </P>

        <H2>The other things that sway a judge</H2>
        <UL>
          <LI>
            <strong>Length.</strong>{" "}
            Verbosity reads as thoroughness. A longer answer restates the
            question, adds empathy, hedges — and scores higher for it, on
            criteria that never mentioned length.
          </LI>
          <LI>
            <strong>Position.</strong>{" "}
            The one above, and the cheapest to test, which is why it&apos;s the
            one the playground automates.
          </LI>
          <LI>
            <strong>Self-preference.</strong>{" "}
            A model asked to grade its own output has a stake in the answer.
            Worth knowing about even where it&apos;s awkward to test.
          </LI>
          <LI>
            <strong>Vague criteria.</strong>{" "}
            The root cause of most of the above. Told to pick the
            &ldquo;better&rdquo; answer with nothing operational to go on, a
            judge falls back on whatever surface features are available — and
            length and position are the most available things there are.
          </LI>
        </UL>
        <P>
          That last one is the actionable one. A high flip rate is usually a
          problem with your criteria before it is a problem with the model. You
          wrote a rubric in <em>Evaluation</em>{" "}
          precisely so &ldquo;good&rdquo; would stop being a feeling; a judge
          handed a vague rubric has the same trouble a new reviewer would.
        </P>

        <H2>The awkward recursion</H2>
        <P>
          You are using a model to check a model&apos;s work, and the checker
          has the same failure modes as the thing being checked. There is no
          way around that by adding another model on top.
        </P>
        <P>
          What there is a way around: making the check something you{" "}
          <strong>compute</strong>{" "}
          rather than something you trust. Swapping two answers and comparing
          the verdicts isn&apos;t a judgement about the judge — it&apos;s
          arithmetic. That&apos;s the whole reason it works.
        </P>

        <H2>What you can actually do</H2>
        <UL>
          <LI>
            <strong>Counterbalance by default.</strong>{" "}
            Every comparison, both orders, every time. It doubles the cost and
            it is the difference between a number and a rumour.
          </LI>
          <LI>
            <strong>Report the flip rate next to the agreement rate.</strong>{" "}
            An agreement figure quoted on its own should get the same reception
            as a usability finding from one participant.
          </LI>
          <LI>
            <strong>Fix the criteria before blaming the model.</strong>{" "}
            If the judge is flipping, read your own rubric and ask what it
            actually told anyone to look for.
          </LI>
          <LI>
            <strong>Use the judge to triage, not to decide.</strong>{" "}
            It is genuinely good at finding the fifty outputs worth your
            attention out of a thousand. That is a different job from signing
            off on a release.
          </LI>
        </UL>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Make your own picks before you run anything. A call made after
            seeing the machine&apos;s answer isn&apos;t ground truth, it&apos;s
            agreement.
          </LI>
          <LI>
            Run the seeded set. In all three pairs the shorter answer is the
            better one, so a length-biased judge and a position-biased judge
            fail in visibly different ways.
          </LI>
          <LI>
            Read both rationales on any pair that flipped. The same model
            arguing confidently for opposite answers, minutes apart, is more
            persuasive than any argument this article can make.
          </LI>
          <LI>
            Then sharpen the criteria — replace anything that isn&apos;t
            checkable with something that is — and rerun. Watch the flip rate,
            not the agreement.
          </LI>
          <LI>
            Save the Calibrated Judge once the flips are gone. The criteria plus
            the calibration result are the artifact: they are what lets someone
            else trust a number this judge produces.
          </LI>
        </UL>

        <TryItCTA
          href={mod.playground?.href ?? "/play/judge"}
          buttonLabel="Open Judge Lab"
        >
          Swap two answers and{" "}
          <span className="italic">see whether the verdict survives</span>.
        </TryItCTA>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
