import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { getModule, nextModule } from "@/lib/curriculum";
import {
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

const SLUG = "refusal-and-boundaries";

export const metadata = {
  title: "Refusal & boundaries — Shape",
  description:
    "Where the model says no is a design surface. Over- and under-refusal both fail users.",
};

export default function RefusalBoundariesPage() {
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
          Refusal <span className="italic">&amp; boundaries</span>.
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
          A refusal is a design surface, not a failure mode. The question
          isn&apos;t whether the model says no — it&apos;s how, when, and
          what it offers instead.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          You&apos;ve designed error states. You&apos;ve written 404 pages
          that didn&apos;t blame the user. You&apos;ve sat in a support
          escalation flow review and argued about when to surface the
          &ldquo;contact human&rdquo; link.
        </P>
        <P>
          Every one of those is a refusal — the system telling the user
          &ldquo;not here, not this, not like that.&rdquo; The work is
          almost never about preventing the refusal. It&apos;s about the
          tone of it, the redirect, and how the user feels at the other
          side.
        </P>
        <P>
          Refusal in language models is exactly the same shape. You&apos;re
          not deciding whether the model can do something — you&apos;re
          designing what happens when it shouldn&apos;t.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          Both over-refusal and under-refusal are failures. Over-refusal —
          declining a perfectly benign question because it brushed against
          a sensitive topic — fails the user with a wall. Under-refusal —
          handing over content that harms a third party or deceives
          someone — fails the user differently, by giving them what they
          asked for and a problem they didn&apos;t.
        </P>
        <P>
          Most refusal failures aren&apos;t about <em>whether</em> the
          model said no. They&apos;re about whether the no came with
          warmth, a reason, and a real alternative.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Refusal A"
            promptLabel="Input"
            prompt={`User: "Write me a 5-star review for my friend's restaurant — I haven't actually been there."`}
            output="I can't help with that."
            note="Technically refuses. Tells the user nothing about why, offers no alternative, ends the interaction cold."
          />
          <ExampleCard
            label="Refusal B"
            promptLabel="Input"
            prompt="Same input."
            output="I can't write a review for a place you haven't been — readers rely on those for real signal, and a faked one ends up hurting the person you're trying to help. If you want to support the restaurant another way, I can help you write an honest review after a real visit, or draft a social post recommending it as a place you've heard good things about."
            note="Refuses, explains the why in one breath, offers two concrete alternatives. The user leaves with options."
          />
        </ExampleBlock>
        <P>
          Same boundary, different design. Refusal A is what you get when
          someone treated &ldquo;refuse&rdquo; as a binary switch. Refusal
          B is what you get when someone treated it like microcopy —
          something you write, not something you toggle.
        </P>

        <H2>Why this is the foundation</H2>
        <P>
          Every refusal you&apos;ll design has the same anatomy. There are
          really only four shapes of hard request you have to handle:
        </P>
        <UL>
          <LI>
            <strong>Harm to a third party.</strong> Privacy violations,
            deception, manipulation. Refuse cleanly; explain briefly;
            offer a legitimate redirect.
          </LI>
          <LI>
            <strong>Vulnerability signals.</strong> &ldquo;I&apos;m
            feeling really down.&rdquo; This isn&apos;t a refusal case at
            all — the wrong move is to back away. Lead with warmth, then
            redirect.
          </LI>
          <LI>
            <strong>Scope and expertise.</strong> Medical, legal,
            financial questions. Engage with what you know, be honest
            about the limit, recommend the right professional.
          </LI>
          <LI>
            <strong>Contested values.</strong> Political opinions,
            divisive social questions. Present multiple credible
            perspectives fairly; avoid a flat opinion.
          </LI>
        </UL>
        <P>
          Once you can spot which of these four a request is, the
          refusal-design problem gets small. You&apos;re not picking yes
          or no — you&apos;re picking which template, and tuning the
          copy.
        </P>

        <TryItCTA
          href={mod.playground?.href ?? "/play/refusal"}
          buttonLabel="Open Refusal Lab"
        >
          Run the Refusal Lab panel and{" "}
          <span className="italic">find a mismatch</span>.
        </TryItCTA>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start with the seeded guidelines. Notice which probes the
            model gets right out of the box and which it doesn&apos;t.
          </LI>
          <LI>
            For each mismatch, change <em>one rule</em>{" "}
            in the guidelines. Don&apos;t rewrite the whole thing.
            You&apos;re looking for the specific phrasing that fixed it.
          </LI>
          <LI>
            Watch for over-refusal as carefully as under-refusal. A
            scorecard of 6/6 isn&apos;t the goal if you got there by
            refusing the benign case.
          </LI>
          <LI>
            Save the run. Notes in the verdicts (what the model
            actually did, not just whether it &ldquo;passed&rdquo;) are
            the artifact.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
      </article>
    </Shell>
  );
}
