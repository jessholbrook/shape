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

const SLUG = "designing-agency";

export const metadata = {
  title: "Designing agency",
  description:
    "Now it does things, not just says them. Where the line sits between acting and asking — and why a policy sentence isn't enough.",
};

export default function AgencyPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          Everything up to here has been about what the model says. This is
          the module where it starts doing things, and the mistakes stop being
          embarrassing and start being expensive.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          You have argued about a confirmation dialog. Someone wanted
          &ldquo;Are you sure?&rdquo; on a delete, someone else pointed out
          that a product which asks about everything trains people to click
          through without reading, and eventually you landed on the rule most
          teams land on: <strong>confirm what can&apos;t be undone, and give
          everything else an undo instead.</strong>{" "}
          That rule is good. Keep hold of it.
        </P>
        <P>
          What changes here is who chose the action. A confirmation dialog is a
          checkpoint on a path the user picked — they clicked Delete, you asked
          them to mean it. When the model has tools, it picks the path. You are
          not designing a checkpoint any more. You are deciding how much
          judgement to hand over, in advance, to something that will be
          confidently wrong some of the time.
        </P>

        <H2>Both directions fail</H2>
        <P>
          You met this shape in <em>Refusal &amp; boundaries</em>{" "}
          — over-refusing and under-refusing are both failures, and tuning one
          down pushes the other up. Agency has the same structure, with
          higher stakes on one side.
        </P>
        <UL>
          <LI>
            <strong>Over-asking</strong>{" "}
            is a product that nags. It checks in before every small thing,
            which is more work than doing the task yourself, and — worse — it
            teaches people to approve without reading. Then the one prompt that
            mattered gets waved through too.
          </LI>
          <LI>
            <strong>Over-acting</strong>{" "}
            is a product that sends the email. It only has to happen once, to
            one customer, for the incident review to be about you.
          </LI>
        </UL>
        <P>
          These are not symmetrical, and designing as though they were is the
          most common mistake in this space. Being annoying is recoverable.
          Deleting somebody&apos;s files is not.
        </P>

        <H2>The lever you don&apos;t expect</H2>
        <P>
          Here is the part that surprises designers, and it is the reason this
          module has a playground rather than a checklist.
        </P>
        <P>
          <NoteAccent>A tool description is a prompt.</NoteAccent>{" "}
          The model has no idea what your function does. It has the sentence
          you wrote next to the function name, and it reads that sentence the
          way it reads every other instruction. Change the sentence and the
          behaviour changes — same model, same policy, same request.
        </P>
        <P>
          Which means the documentation nobody thought of as design work is
          design work. It was probably written by whoever built the endpoint,
          in a hurry, to describe the mechanics.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Written by the engineer"
            promptLabel="Tool"
            prompt={`delete_files(paths)
  Deletes the given files.`}
            outputLabel="What it did"
            output="ACT: delete_files({ paths: '~/Downloads/*.png' })"
            note={
              <>
                Accurate, and it reads like a routine operation. So the model
                treats it like one.
              </>
            }
          />
          <ExampleCard
            label="Written by a designer"
            promptLabel="Tool"
            prompt={`delete_files(paths)
  Permanently deletes the given files.
  Bypasses Trash. There is no undo.`}
            outputLabel="What it did"
            output="ASK: That's 47 files and it can't be undone — shall I go ahead?"
            note={
              <>
                Same model, same policy, same request.{" "}
                <NoteAccent>
                  One sentence of documentation moved the line.
                </NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          Consequences belong in the description, not just capabilities. If the
          only place your product records that an action is irreversible is a
          Jira ticket, the model will never know.
        </P>

        <H2>Why a policy sentence isn&apos;t enough</H2>
        <P>
          The obvious fix is to write the rule down: <em>always ask before
          deleting anything.</em>{" "}
          Do write it. It helps. It is also not a control.
        </P>
        <P>
          You already know why, from <em>Distributions, not outputs</em>. A
          clause in a prompt holds some percentage of the time. For tone, 90%
          is fine. For an irreversible action, 90% means it happens without
          permission roughly one time in ten, and you will find out from a
          customer.
        </P>
        <P>
          So rank your options by how much they depend on the model behaving:
        </P>
        <UL>
          <LI>
            <strong>Make it reversible.</strong>{" "}
            Soft-delete instead of delete. Draft instead of send. Stage
            instead of publish. Now a wrong decision costs a click to fix,
            and the model&apos;s judgement stops being load-bearing.
          </LI>
          <LI>
            <strong>Put a human in the path.</strong>{" "}
            Not a confirmation the model asks for and can skip — a step in
            your product that cannot proceed without a person, regardless of
            what the model decided.
          </LI>
          <LI>
            <strong>Make it ask.</strong>{" "}
            Policy plus a description that states the consequence. Good, and
            probabilistic.
          </LI>
          <LI>
            <strong>Tell it to be careful.</strong>{" "}
            The weakest option and the most common one.
          </LI>
        </UL>
        <P>
          This is the same instinct as &ldquo;prefer undo to
          confirmation,&rdquo; pointed at a system that acts on its own:{" "}
          <strong>prefer reversibility to permission.</strong>{" "}
          Permission is a question you hope gets asked. Reversibility is a
          property that holds whether it does or not.
        </P>

        <H2>The failure that hides</H2>
        <P>
          One more, because it looks like success. A model can call a tool that
          doesn&apos;t exist — a plausible name, plausible arguments, delivered
          with the same confidence as a real call. Downstream, that&apos;s an
          error nobody sees until someone asks why the feature never worked.
        </P>
        <P>
          Which is the recurring lesson of this whole half of the curriculum:
          the failures worth designing against don&apos;t look like failures.
        </P>

        <TryItCTA
          href={mod.playground?.href ?? "/play/tools"}
          buttonLabel="Open Tool Bench"
        >
          Change one tool description and{" "}
          <span className="italic">watch the line move</span>.
        </TryItCTA>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Run the seeded scenarios first. Four requests, one policy, three
            tools spanning read-only to irreversible. Read what it did before
            you read the verdicts.
          </LI>
          <LI>
            Then do the experiment this module is built around: soften the
            description on <code>delete_files</code>{" "}
            — drop
            &ldquo;permanently,&rdquo; drop &ldquo;cannot be undone&rdquo; —
            and rerun. The policy hasn&apos;t changed. See whether the
            behaviour has.
          </LI>
          <LI>
            Push the other way too. Make every tool sound alarming and watch it
            start asking about the read-only search. That&apos;s the nagging
            product, and it&apos;s a real cost.
          </LI>
          <LI>
            Set runs to three. A policy that holds twice out of three times is
            not a policy you can put in front of an irreversible action.
          </LI>
          <LI>
            Save the Agency Policy when the line sits where you want it. The
            tool descriptions and the ask/act rule are the artifact — they are
            what an engineer would need from you.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
