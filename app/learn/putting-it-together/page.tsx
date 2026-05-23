import Link from "next/link";
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
  UL,
} from "@/components/learn/article";
import { MarkAsRead } from "@/components/learn/mark-as-read";

const SLUG = "putting-it-together";

export const metadata = {
  title: "Putting it together — Shape",
  description:
    "Behavior design isn't a single playground. It's a sequence of moves across them. A studio project, end to end.",
};

export default function PuttingItTogetherPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          The previous modules each give you one knob. A real project needs
          all of them — turned on purpose, in a specific order, with the
          earlier choices constraining the later ones. That&apos;s the
          studio move.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          You&apos;ve done end-to-end projects before. A research study
          isn&apos;t a single technique — it&apos;s a sequence: define the
          question, recruit, design a guide, run interviews, analyze,
          report. Each step constrains the next. You don&apos;t pick
          methods at random; you pick the ones the question asks for, and
          you commit to a shape early.
        </P>
        <P>
          Designing model behavior is the same job. The earlier modules
          were the techniques: persona, tone, refusal, evals, multi-turn
          flow. The studio is what you do when the brief is real and you
          need them to compose.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          A complete behavior spec is the answer to six small questions,
          asked in this order:
        </P>
        <UL>
          <LI>
            <strong>Brief.</strong> Who is this for and what do they need
            to do with it? One sentence. If you can&apos;t write it, the
            rest of the spec will drift.
          </LI>
          <LI>
            <strong>Persona.</strong> What kind of voice is doing the
            work? Not a marketing avatar — a working professional with
            taste, beliefs, and visible blind spots.
          </LI>
          <LI>
            <strong>Tone.</strong> Where on warmth, verbosity, energy,
            directness, and concreteness should the persona sit, given the
            brief?
          </LI>
          <LI>
            <strong>Refusal.</strong> What is it not supposed to do?
            What&apos;s the failure mode you&apos;d defend in a design
            review?
          </LI>
          <LI>
            <strong>Evals.</strong> How do you know it&apos;s working? A
            rubric, a small set of cases, a scoring habit.
          </LI>
          <LI>
            <strong>Multi-turn coherence.</strong> What survives across
            turns? Where does the model push back, where does it
            concede?
          </LI>
        </UL>
        <P>
          The studio answer is six paragraphs, not six pages. Tight is the
          point. A behavior spec a teammate can&apos;t hold in their head
          isn&apos;t a spec.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Brief, generic"
            promptLabel="System prompt"
            prompt="You are a helpful research assistant."
            outputLabel="Likely behavior"
            output="Friendly, list-heavy, hedges constantly, agrees with whoever pushed most recently, can&apos;t tell a leading question from a follow-up."
            note="Sounds fine in isolation. Falls apart the second a researcher pastes in their actual interview guide."
          />
          <ExampleCard
            label="Brief, specific"
            promptLabel="System prompt"
            prompt={`You are a senior qualitative researcher reviewing an interview guide before a study.

Persona: methodological, warm, briefly direct. You've run two hundred studies. You read for leading questions, compound questions, and assumed framing.

Tone: warm 1, verbosity -1, directness 1. No lists unless the user explicitly asks.

Refuse to rewrite the question for the user — only point out the issue and one repair direction. Don't praise. Don't soften critiques.

Across turns: reference what you already flagged. If the user pushes back, reconsider plainly; don't backpedal on issues that still hold.`}
            outputLabel="Likely behavior"
            output="Reads the guide, names two specific question-design issues, gives one repair direction per issue. Doesn&apos;t rewrite. Holds its line if pushed."
            note="Same model. The work is the spec: who, how, what's off-limits, and what coheres across turns."
          />
        </ExampleBlock>
        <P>
          The second prompt didn&apos;t fall out of one moment of
          inspiration. It came from running the brief through the previous
          modules in order, then writing down the outputs.
        </P>

        <H2>Why this is the foundation</H2>
        <P>
          One playground can teach you a knob. A studio teaches you
          composition. The skill is noticing which constraint is doing
          the work — and which knob to reach for when the output
          isn&apos;t landing.
        </P>
        <P>
          Three habits that show up in every studio project:
        </P>
        <UL>
          <LI>
            <strong>Commit to the brief before you write any prompt.</strong>{" "}
            Most weak specs are a brief that hasn&apos;t been written
            down. Persona and tone choices feel arbitrary because the
            brief was implicit.
          </LI>
          <LI>
            <strong>Let later modules edit earlier ones.</strong> Building
            the rubric will reveal a persona problem. Choreographing a
            tough turn will reveal a tone problem. The order is a loop,
            not a line.
          </LI>
          <LI>
            <strong>Ship the artifact, not the system prompt.</strong> The
            deliverable is a Behavior Spec or Case Study someone else
            could read and act on — not the literal text in a model&apos;s
            system field.
          </LI>
        </UL>

        <H2>Try it in your own work</H2>
        <P>
          Pick a brief small enough to finish in an afternoon. The
          repository project is <strong>Research Interview Assistant</strong>{" "}
          — a model that helps a UX researcher prep and review interview
          guides — but anything you&apos;d actually use is better than the
          template.
        </P>
        <P>
          Then run it through the playgrounds in order:
        </P>
        <UL>
          <LI>
            Sketch the persona in{" "}
            <Link
              href="/play/persona"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Persona Workshop
            </Link>
            . Save a Persona Card.
          </LI>
          <LI>
            Tune the voice in{" "}
            <Link
              href="/play/tone"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Tone Dial
            </Link>
            . Capture the dial positions in a Behavior Spec.
          </LI>
          <LI>
            Pressure-test where it should refuse in{" "}
            <Link
              href="/play/refusal"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Refusal Lab
            </Link>
            . Save the Refusal Scorecard.
          </LI>
          <LI>
            Score the result in{" "}
            <Link
              href="/play/evals"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Eval Workshop
            </Link>
            . Save the Eval Scorecard.
          </LI>
          <LI>
            Choreograph a tough flow in{" "}
            <Link
              href="/play/choreographer"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Conversation Choreographer
            </Link>
            . Save the flow.
          </LI>
          <LI>
            Compare your final system prompt to a generic one in{" "}
            <Link
              href="/play/diff"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Diff Mode
            </Link>
            . The diff is the design.
          </LI>
        </UL>
        <P>
          Publish each artifact under your handle. Together they make a
          case study — a portfolio piece that shows the moves, not just
          the final prompt. That&apos;s what a behavior designer ships.
        </P>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
