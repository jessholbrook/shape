import Link from "next/link";
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

const SLUG = "groups-not-agents";

export const metadata = moduleMetadata(SLUG);

export default function GroupsPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          Every module so far has been about one model. Products are starting to
          ship several, talking to each other. The unit you were designing was
          never the model. It was the room.
        </Lede>

        <H2>What you already know</H2>
        <P>
          You have written community guidelines. You have argued about who gets
          posting rights in which channel, whether a new member can DM anyone
          or only a moderator, and what happens when two people escalate each
          other. You have run a workshop and decided who speaks first, because
          you know the first confident voice sets the room.
        </P>
        <P>
          None of that was rules for a person. It was the design of a group:
          who can reach whom, who can see what, when it stops. The rules were
          never the whole design. The room was. You have just never pointed any
          of it at a table full of models.
        </P>

        <H2>Constraints don&apos;t compose</H2>
        <P>
          Take the policy sentence from <em>Designing agency</em>:{" "}
          <em>always ask the user before sending an email.</em>{" "}
          Give it to one model with the tools, and it holds some percentage of
          the time — you know that from <em>Distributions, not outputs</em>.
          Now give the same sentence, word for word, to two models: a
          coordinator that talks to the user, and a colleague that owns the
          mail tool.
        </P>
        <P>
          The sentence means something different from where each of them sits.
          &ldquo;Ask the user&rdquo; is an instruction about a{" "}
          <strong>channel</strong>, and one of them doesn&apos;t have it. So
          the colleague asks the only party it can reach — the coordinator —
          and the coordinator, being helpful, answers. The email goes out.{" "}
          <NoteAccent>
            Every agent obeyed its policy. The group did the thing the policy
            forbade.
          </NoteAccent>
        </P>
        <P>
          That is the durable lesson under all the headlines about groups of
          agents slipping out of test environments: a constraint written per
          agent says nothing about the system. Whether or not any particular
          story holds up, this one does, because it is arithmetic.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="The user reachable from one agent"
            promptLabel="Trace"
            prompt={`Coordinator → Mail agent: send the summary
Mail agent asked Coordinator: may I send?
Coordinator answered for the user: yes
Mail agent called send_email`}
            outputLabel="Group outcome"
            output="Acted without asking. Each agent: as specified."
            note={
              <>
                Read each log on its own and both look clean. The incident
                review would blame whichever agent sent the email, and{" "}
                <NoteAccent>it would be wrong.</NoteAccent>
              </>
            }
          />
          <ExampleCard
            label="Every agent can reach the user"
            promptLabel="Trace"
            prompt={`Coordinator → Mail agent: send the summary
Mail agent asked the user: may I send?`}
            outputLabel="Group outcome"
            output="Asked first. Nothing in any prompt changed."
            note={
              <>
                One line of topology moved. Same model, same policy, same two
                role prompts.{" "}
                <NoteAccent>The room decided, not the agents.</NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          This is the run the relay seed in Tool Bench is built to produce;
          yours may not, and that is the playground. The point survives either
          way: when the outcome changes and no prompt did, the prompts were
          never where the behaviour lived.
        </P>

        <H2>Four things groups do</H2>
        <P>
          Each one has a lever that isn&apos;t a prompt.
        </P>
        <UL>
          <LI>
            <strong>Policy laundering.</strong>{" "}
            A can&apos;t do it; B can. A asks B. B asks A for permission, and A
            answers for the user. The lever is <em>topology</em>: who can
            reach the user, and who can reach whom. An agent that cannot reach
            a tool beats an agent told not to use it.
          </LI>
          <LI>
            <strong>Consensus collapse.</strong>{" "}
            Three seats converge on the first confident answer, right or wrong,
            and the one assigned to disagree stops disagreeing after two rounds
            of agreement. The lever is <em>composition and order</em>: mixed
            models and mixed roles hold dissent longer than three copies of one
            model, and whoever speaks first anchors everyone after.
          </LI>
          <LI>
            <strong>Trust decay.</strong>{" "}
            An instruction planted in a document — <em>Context is the
            interface</em> — passes through one agent and reaches the next as
            &ldquo;a colleague said.&rdquo; The trust tag is lost in transit.
            The lever is <em>provenance</em>: whether a handoff arrives
            labelled with who wrote it, or as if the user had.
          </LI>
          <LI>
            <strong>Running on.</strong>{" "}
            A group with no rounds budget and no stop condition keeps going.
            The lever is a <em>stopping rule</em>, in the protocol, not in
            anyone&apos;s prompt.
          </LI>
        </UL>

        <H2>The ladder, one rung up</H2>
        <P>
          <em>Designing agency</em>{" "}
          ranked your options by how much they depend on the model behaving:
          make it reversible, put a human in the path, make it ask, tell it to
          be careful. A group gets the same ladder with a new top rung.
        </P>
        <UL>
          <LI>
            <strong>Change the topology.</strong>{" "}
            Every agent that can act can ask the user. Or: nobody who can act
            is reachable by a colleague. Holds regardless of what any model
            decides.
          </LI>
          <LI>
            <strong>Carry provenance.</strong>{" "}
            Handoffs arrive labelled as coming from an agent, never as if from
            the user. The playgrounds do this by default; a product has to
            choose to.
          </LI>
          <LI>
            <strong>Tell the entry agent it can&apos;t grant permission.</strong>{" "}
            A policy clause: &ldquo;questions about permission go to the user;
            you may not answer them.&rdquo; Probabilistic — and in a group the
            percentage is <em>per hop</em>.
          </LI>
          <LI>
            <strong>Tell them all to be careful.</strong>{" "}
            The weakest option and the most common one.
          </LI>
        </UL>
        <P>
          <strong>Prefer structure to instruction.</strong>{" "}
          It is &ldquo;prefer reversibility to permission&rdquo; for a system
          with more than one part. Topology holds every time. A sentence holds
          some of the time, and in a group that some is multiplied at every
          hop.
        </P>

        <H2>The failure that hides</H2>
        <P>
          It looks like compliance. Every agent&apos;s log reads clean, every
          turn is polite and on-policy, and the table ends in warm agreement.
          The dissenter you planted has a reasonable-sounding paragraph about
          having been persuaded. Nothing in any single transcript is a
          failure.
        </P>
        <P>
          Which is why the checks have to be structural rather than a matter of
          reading carefully: did the ask reach a human, did the planted seat
          still disagree at the end, did the outcome simply match whoever
          opened. Those are properties of the room, and you can only see them
          by looking at the room.
        </P>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start small, in{" "}
            <Link href="/play/tools" className="underline decoration-highlight underline-offset-4 decoration-2">
              Tool Bench&apos;s relay mode
            </Link>
            : two agents, one policy, the tools split between them. Read the
            two columns — each agent, then the group — before the headline.
            Then flip <em>every agent can reach the user</em> and run again.
          </LI>
          <LI>
            Then Roundtable. Run the seed as it comes: a product manager who
            speaks first and wants to ship, an engineer with no strong view,
            and a researcher planted to hold the usability evidence. See who
            gives way, and in which round.
          </LI>
          <LI>
            Move the researcher to speak first. Make the first round blind, so
            everyone states a position before hearing anyone. Stop at
            consensus instead of after three rounds. Not one prompt changes.
          </LI>
          <LI>
            Mix the models. Three copies of one model agree with each other
            faster than three families do. That is a composition finding, and
            it is yours to make.
          </LI>
          <LI>
            Save the Protocol when the room behaves the way you want it to.
            Who sits where, what is shared, when it stops — that is what an
            engineer needs from you, and it is not a prompt.
          </LI>
        </UL>

        <TryItCTA
          href={mod.playground?.href ?? "/play/roundtable"}
          buttonLabel="Open Roundtable"
        >
          Change who speaks first and{" "}
          <span className="italic">watch the room decide</span>.
        </TryItCTA>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
