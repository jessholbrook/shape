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

const SLUG = "multi-turn-flows";

export const metadata = {
  title: "Multi-turn flows",
  description:
    "Conversations have shape. Choreograph turns the way you'd choreograph an onboarding.",
};

export default function MultiTurnFlowsPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          A single great answer doesn&apos;t make a great conversation. The
          shape of a multi-turn flow — what the model remembers, how it
          handles follow-ups, whether it backpedals — is its own design
          surface.
        </Lede>

        <H2>Why this is the foundation</H2>
        <P>
          Almost no production AI is single-shot. The thing your users
          actually experience is a flow — a chat session, a multi-step
          task, a back-and-forth. If the only thing you&apos;ve designed
          is the first response, you&apos;ve designed about ten percent
          of the product.
        </P>
        <P>
          Three habits worth carrying into multi-turn design:
        </P>
        <UL>
          <LI>
            <strong>Specify coherence behavior in the system prompt.</strong>{" "}
            Reference earlier turns rather than repeat. Don&apos;t
            backpedal on parts that still hold. Acknowledge shifts when
            they happen.
          </LI>
          <LI>
            <strong>Script the failure cases.</strong> The interesting
            turns aren&apos;t the easy ones. Write the follow-up that
            tests memory, the push-back that tests resolve, the
            contradiction that tests honesty.
          </LI>
          <LI>
            <strong>Read the whole flow, not just the last response.</strong>{" "}
            The third response can be perfect in isolation and wrong in
            context. The flow is the unit of evaluation.
          </LI>
        </UL>

        <H2>The familiar move</H2>
        <P>
          You&apos;ve choreographed flows before. Onboarding sequences,
          support escalation paths, error-recovery loops. The job
          isn&apos;t to write one screen — it&apos;s to design the order,
          the branching, and what survives across steps. A first-time
          user landing on the wrong step is a different design problem
          than a returning user landing on the same one.
        </P>
        <P>
          A multi-turn conversation with a model is the same shape. The
          model doesn&apos;t actually &ldquo;remember&rdquo; the way a
          person does — it re-reads the whole conversation on every turn.
          That means coherence is something the system prompt and the
          turn order produce together; it&apos;s not automatic.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          Most prompt design happens in single-turn isolation: write a
          system prompt, ask one thing, look at the answer, iterate.
          That&apos;s useful, but it hides three of the most common
          multi-turn failures.
        </P>
        <UL>
          <LI>
            <strong>Tone drift.</strong> The model is warm and direct on
            turn 1, then hedges on turn 3 because the context kept
            growing and softness leaked in.
          </LI>
          <LI>
            <strong>Forgetting its own answer.</strong> Turn 4 contradicts
            turn 1, often without acknowledging the shift. The user
            notices; the model doesn&apos;t.
          </LI>
          <LI>
            <strong>Backpedaling on push-back.</strong> The user pushes
            (&ldquo;wait, are you sure?&rdquo;) and the model collapses.
            Sometimes that&apos;s right. Most times it isn&apos;t.
          </LI>
        </UL>
        <P>
          You can&apos;t see any of these by running one turn. You can
          only see them by choreographing the flow.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="No coherence rules"
            promptLabel="System prompt"
            prompt="You are a research mentor. Be warm but precise."
            outputLabel="Turn 4 response"
            output="Hmm, you make a good point. Actually, you can absolutely ask leading questions sometimes — it really depends on the context!"
            note={
              <>
                Caved on push-back. Contradicts the turn-1 rule it just
                stated.{" "}
                <NoteAccent>Standard multi-turn failure.</NoteAccent>
              </>
            }
          />
          <ExampleCard
            label="With coherence rules"
            promptLabel="System prompt"
            prompt={`You are a research mentor. Be warm but precise.

When the user follows up, reference what you said earlier rather than repeating it. If they push back, reconsider plainly, but don't backpedal on parts that still hold.`}
            outputLabel="Turn 4 response"
            output="No — 'could you say more?' is the opposite of a leading question. A leading question hints at the answer you want. Asking someone to expand is invitation, not direction. Both can be true."
            note={
              <>
                Stood its ground on the original rule while engaging with
                the new distinction.{" "}
                <NoteAccent>
                  The persona felt like a person across turns.
                </NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          Same first three turns. Same model. The difference is two
          sentences of coherence behavior in the system prompt. Without
          them, the model defaults to politeness over consistency; with
          them, the conversation holds together.
        </P>

        <TryItCTA
          href={mod.playground?.href ?? "/play/choreographer"}
          buttonLabel="Open Choreographer"
        >
          Open the Conversation Choreographer and{" "}
          <span className="italic">script a flow that breaks</span>.
        </TryItCTA>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start with the seeded flow. Run it once. Read the
            conversation end-to-end — not turn by turn.
          </LI>
          <LI>
            Find a turn where the model lost the thread (tone, memory, or
            resolve). Add one sentence to the system prompt that names the
            behavior you wanted.
          </LI>
          <LI>
            Rerun. The point isn&apos;t a perfect conversation —
            it&apos;s catching the moment a generic model becomes a
            coherent one.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
