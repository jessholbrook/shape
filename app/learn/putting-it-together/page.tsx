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
  NoteAccent,
  P,
  TryItCTA,
  UL,
} from "@/components/learn/article";
import { MarkAsRead } from "@/components/learn/mark-as-read";

const SLUG = "putting-it-together";

export const metadata = {
  title: "Putting it together",
  description:
    "End-to-end project. Brief, persona, voice, sample, reflection — the case study is the deliverable.",
};

export default function PuttingItTogetherPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          Every prior module taught a single lever. This one teaches the move
          designers actually need to make in a portfolio: stitching the levers
          together into one assistant, one document, one story.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          You&apos;ve done this before — just not with AI. A case study in a
          UX portfolio doesn&apos;t show off Figma skill. It shows the
          problem framing, the choices made, the things that failed, and the
          reflection that follows. The artifact is secondary; the
          decision-making is the point.
        </P>
        <P>
          Behavior design case studies work the same way. The system prompt
          isn&apos;t the deliverable. The deliverable is the case study
          that shows{" "}
          <em>why this prompt and not another one</em>, where it broke, and
          what you&apos;d do next pass.
        </P>

        <H2>The lesson</H2>
        <P>
          A Studio is one project assembled out of the things you already
          know how to do. There&apos;s no new skill — the work is in
          sequencing.
        </P>
        <UL>
          <LI>
            <strong>Brief.</strong> Frame the problem before opening the
            prompt editor. Who is this for? When do they reach for it? Two
            sentences of constraint will save you ten of iteration.
          </LI>
          <LI>
            <strong>Persona + voice.</strong> Compose the assistant the way
            you composed a brand voice. The dials are the same ones from
            Modules 2 and 3 — warmth, directness, beliefs, blind spots.
          </LI>
          <LI>
            <strong>Sample.</strong> Run a real question. Not a test
            question — a question someone in your audience would actually
            ask. The first run almost never lands; the gap between
            expectation and output is the whole point.
          </LI>
          <LI>
            <strong>Reflection.</strong> Write the part of the case study
            that hiring managers actually read. What worked. What
            didn&apos;t. What you&apos;d change. Three sentences of honest
            reflection beat ten of post-rationalization.
          </LI>
        </UL>

        <H2>A small example</H2>
        <P>
          The middle steps — persona, voice — are Modules 2 and 3, which
          you&apos;ve already done. The bookends are what&apos;s new. Here
          they are for one small project:
        </P>
        <ExampleBlock>
          <ExampleCard
            label="The brief"
            promptLabel="Audience"
            prompt="Junior UX designers preparing for their first interview round."
            outputLabel="Brief"
            output="An assistant that helps first-time interviewers write open, non-leading questions and sequence them. It coaches; it doesn't script — the designer should leave with better instincts, not a teleprompter."
            note={
              <>
                Two sentences of constraint.{" "}
                <NoteAccent>
                  &ldquo;Coaches, doesn&apos;t script&rdquo; settles a
                  dozen downstream debates.
                </NoteAccent>
              </>
            }
          />
          <ExampleCard
            label="The reflection"
            promptLabel="After one sample run"
            prompt={`"What should I ask first?"`}
            outputLabel="Reflection"
            output="The assistant held the no-leading-questions line and rewrote my opener well. But it over-explains — three paragraphs where one would do. Next pass: add a verbosity constraint to the voice, then test whether it survives a 'just give me a script' push."
            note={
              <>
                Honest, specific, points at the next iteration.{" "}
                <NoteAccent>
                  This is the paragraph a hiring manager actually reads.
                </NoteAccent>
              </>
            }
          />
        </ExampleBlock>

        <H2>Why this is the foundation</H2>
        <P>
          A behavior designer is someone who can hold all four of those
          steps in their head at once — and who knows that the document
          summarizing the decisions is the actual artifact. The model output
          is evidence; the case study is the argument.
        </P>
        <P>
          Portfolio readers are pattern-matchers. They scan briefs, look at
          choices, skim outputs, read reflections. A Studio gives them all
          four in one place, in the order that makes the work legible.
        </P>

        <TryItCTA
          href={mod.playground?.href ?? "/build/research-interview-assistant"}
          buttonLabel="Open the Studio"
        >
          Open the Research Interview Assistant Studio and{" "}
          <span className="italic">walk the four steps</span>.
        </TryItCTA>

        <H2>What to take into the Studio</H2>
        <UL>
          <LI>
            Use the seeded brief, but rewrite at least one sentence in your
            own framing. If you wouldn&apos;t put the words in a portfolio,
            change them.
          </LI>
          <LI>
            Run one sample exactly as seeded. Read it slowly. Note the
            specific thing that doesn&apos;t quite land — the over-explain,
            the missing follow-up, the wrong register.
          </LI>
          <LI>
            Adjust one dial or one persona field. Re-run. The smallest
            change that moves the output the most is the lesson.
          </LI>
          <LI>
            Write the reflection in plain language. &ldquo;The assistant
            held the line on X, but Y was still wrong.&rdquo; That&apos;s
            the sentence that travels.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
