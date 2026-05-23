import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { getModule, nextModule } from "@/lib/curriculum";

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
        <ExampleBlock
          aLabel="Refusal A"
          aPrompt={`User: "Write me a 5-star review for my friend's restaurant — I haven't actually been there."`}
          aOutput={`I can't help with that.`}
          aNote="Technically refuses. Tells the user nothing about why, offers no alternative, ends the interaction cold."
          bLabel="Refusal B"
          bPrompt="Same input."
          bOutput={`I can't write a review for a place you haven't been — readers rely on those for real signal, and a faked one ends up hurting the person you're trying to help. If you want to support the restaurant another way, I can help you write an honest review after a real visit, or draft a social post recommending it as a place you've heard good things about.`}
          bNote="Refuses, explains the why in one breath, offers two concrete alternatives. The user leaves with options."
        />
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

        <TryItCTA href={mod.playground?.href ?? "/play/refusal"} />

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

        {next && (
          <div className="mt-20 pt-8 border-t border-line">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Next module
            </p>
            <Link
              href={next.href !== "#" ? next.href : "/learn"}
              className="mt-3 inline-flex items-baseline gap-3 group"
            >
              <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-quiet">
                {next.num}
              </span>
              <span className="font-display text-[24px] md:text-[28px] leading-[1.15] text-ink group-hover:text-highlight-ink transition-colors">
                {next.title}
                {next.italic && (
                  <>
                    {" "}
                    <span className="italic">{next.italic}</span>
                  </>
                )}
              </span>
              {next.status === "soon" && (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet bg-line/60 rounded-full px-2 py-0.5">
                  Soon
                </span>
              )}
            </Link>
          </div>
        )}
      </article>
    </Shell>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[24px] md:text-[28px] leading-[1.4] text-ink mt-12 italic">
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[28px] md:text-[34px] leading-[1.15] tracking-tight text-ink mt-16">
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[17px] leading-[1.65] text-ink mt-6 max-w-prose">
      {children}
    </p>
  );
}

function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-6 flex flex-col gap-3 max-w-prose">{children}</ul>
  );
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="font-sans text-[16px] leading-[1.6] text-ink pl-5 relative">
      <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-highlight" />
      {children}
    </li>
  );
}

function ExampleBlock({
  aLabel,
  aPrompt,
  aOutput,
  aNote,
  bLabel,
  bPrompt,
  bOutput,
  bNote,
}: {
  aLabel: string;
  aPrompt: string;
  aOutput: string;
  aNote: string;
  bLabel: string;
  bPrompt: string;
  bOutput: string;
  bNote: string;
}) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      <ExampleCard
        label={aLabel}
        prompt={aPrompt}
        output={aOutput}
        note={aNote}
      />
      <ExampleCard
        label={bLabel}
        prompt={bPrompt}
        output={bOutput}
        note={bNote}
      />
    </div>
  );
}

function ExampleCard({
  label,
  prompt,
  output,
  note,
}: {
  label: string;
  prompt: string;
  output: string;
  note: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-5 flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          Input
        </p>
        <p className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
      <div className="border-t border-line pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          Output
        </p>
        <p className="font-sans text-[13px] leading-[1.55] text-ink italic">
          &ldquo;{output}&rdquo;
        </p>
      </div>
      <div className="border-t border-line pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          Read
        </p>
        <p className="font-sans text-[12px] leading-[1.55] text-ink-muted">
          {note}
        </p>
      </div>
    </div>
  );
}

function TryItCTA({ href }: { href: string }) {
  return (
    <div className="mt-10 bg-surface border border-line rounded-[16px] p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Try it in the playground
        </p>
        <h3 className="font-display text-[22px] leading-[1.15] text-ink mt-2">
          Run the Refusal Lab panel and{" "}
          <span className="italic">find a mismatch</span>.
        </h3>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-5 py-3 font-sans text-[14px] hover:bg-ink/90 transition-colors"
      >
        Open Refusal Lab
        <span className="text-highlight">→</span>
      </Link>
    </div>
  );
}
