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
  Template,
  TryItCTA,
  UL,
} from "@/components/learn/article";
import { MarkAsRead } from "@/components/learn/mark-as-read";

const SLUG = "personas-for-ai";

export const metadata = {
  title: "Personas for AI",
  description:
    "Character design isn't decoration. Backstory, beliefs, and blind spots shape every response.",
};

export default function PersonasForAIPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          A persona is more than a name and a role. The interesting bits —
          backstory, beliefs, blind spots — are what make the model sound
          like someone, not something.
        </Lede>

        <H2>Why this is the foundation</H2>
        <P>
          Voice and tone (Module 2) decide how the model speaks. Persona
          decides who&apos;s speaking. Once you have a strong persona, a
          lot of the smaller decisions get easier — refusals fall out of
          beliefs, scope falls out of backstory, voice falls out of how
          they would actually talk. You&apos;re not maintaining a long
          list of rules; you&apos;re consulting a character.
        </P>
        <P>
          Three things to put real weight on when you author one:
        </P>
        <UL>
          <LI>
            <strong>A specific backstory.</strong> Not &ldquo;has lots of
            experience.&rdquo; Ten years doing ethnographic research,
            then product. The specifics give the model something to
            reach for.
          </LI>
          <LI>
            <strong>At least one belief.</strong> Something they&apos;d
            push back on. Without a belief, the persona collapses into a
            yes-machine on contact with a hard question.
          </LI>
          <LI>
            <strong>A blind spot named out loud.</strong> What does this
            persona <em>not</em> do? Saying so prevents the model from
            cheerfully wandering into territory the character would
            actually decline.
          </LI>
        </UL>

        <H2>The familiar move</H2>
        <P>
          You&apos;ve built user personas. Maya, 34, design lead at a mid-
          sized startup, frustrated with handoff churn, reads design
          Twitter on her commute. The whole point of writing all that down
          was that &ldquo;the user&rdquo; was too vague to design for. Once
          you had Maya, the next question — should this empty state be
          tutorial-y or get-out-of-the-way? — had an obvious answer.
        </P>
        <P>
          A persona for the model is the same move, applied to the other
          side of the screen. You&apos;re no longer designing for a Maya
          who&apos;s using the product. You&apos;re designing the
          character the product becomes when it talks to her.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          Most AI personas in the wild stop at name and role: &ldquo;You
          are a helpful research assistant.&rdquo; That&apos;s a job
          title, not a character. The model fills the gap with something
          generic — which is fine if generic is what you want, but most
          design problems aren&apos;t solved by generic.
        </P>
        <P>
          The bits that turn a job title into a character are the bits
          you&apos;d include in a user persona: a backstory that explains
          how they got here, beliefs they&apos;ll defend, a voice with
          texture, and blind spots they&apos;ll back away from. The
          contradictions are especially load-bearing. A persona who
          believes &ldquo;curiosity beats charm&rdquo; will run a
          different interview than a persona who believes &ldquo;rapport
          first, then questions.&rdquo; Both can be right. Picking one is
          design.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Job title"
            promptLabel="Persona"
            prompt={`You are a helpful research assistant.`}
            outputLabel="Output"
            output="Welcome! I'm here to help with your research. What would you like to work on today?"
            note={
              <>
                No viewpoint, no texture, no opinions.{" "}
                <NoteAccent>
                  Hard to distinguish from any other product.
                </NoteAccent>
              </>
            }
          />
          <ExampleCard
            label="Character"
            promptLabel="Persona"
            prompt={`You are Iris, a senior researcher who's been running interviews for ten years. You believe most interviews fail in the first ninety seconds because the interviewer asks a leading question. You're warm but you cut to it. You use the word "notice" a lot.`}
            outputLabel="Output"
            output="Hi — before we get into your study, what specifically are you hoping to notice? A real behavior, a quote, a moment? If we can name it now, your first three questions get easier."
            note={
              <>
                Opinionated, specific, recognizable.{" "}
                <NoteAccent>The output sounds like Iris because Iris exists.</NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          Both are &ldquo;helpful.&rdquo; One is a vending machine. The
          other is someone with a perspective. The difference is whether
          you wrote the character or left the model to imagine one.
        </P>

        <H2>A scaffold to start from</H2>
        <P>
          When you sit down to write one, fill the blanks in this order.
          The first sentence builds the body. The second builds the
          point of view. The last builds the edge.
        </P>
        <Template
          checklist={[
            "Persona — who they are and what shaped them",
            "Beliefs — what they'd defend, what they'd push back on",
            "Constraints — what they won't do or talk about",
            "Tone — three or four traits that color how they speak",
          ]}
        >
          {`You are ____ who's been ____ for ____.
You believe ____ because ____.
You won't ____ — instead you'll ____.
Your voice is ____, ____, and ____.`}
        </Template>

        <TryItCTA
          href={mod.playground?.href ?? "/play/persona"}
          buttonLabel="Open Persona Workshop"
        >
          Open Persona Workshop and{" "}
          <span className="italic">build a character</span>.
        </TryItCTA>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start with the seeded Iris persona. Read what comes out of
            the box, then change <em>one field</em> — beliefs, say — and
            re-ask the same question. Notice what shifts.
          </LI>
          <LI>
            Resist the urge to make the persona perfect. A persona who
            agrees with everyone is just the model with a name on it.
            Pick a real opinion.
          </LI>
          <LI>
            Once the character feels like someone, save the draft. The
            persona card is the artifact — a hand-off, not a tweak.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
