import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { CLASS_IDLE_DAYS, CLASS_RETENTION_DAYS } from "@/lib/classroom";
import { USAGE_COUNTER_DAYS } from "@/lib/privacy";

export const metadata = {
  title: "Privacy & data",
  description:
    "What Shape stores, where your prompts go, how long class data is kept, and what stays in your browser.",
};

/**
 * Written from what the code does, not what we'd like it to do. When a
 * behavior changes (retention, a new provider, a new stored field), this page
 * changes in the same PR. Retention numbers come from lib/classroom.ts so
 * they can't drift.
 */
export default function PrivacyPage() {
  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-24">
        <SectionNumber>Privacy</SectionNumber>
        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          Privacy &amp; <span className="italic">data</span>
        </h1>
        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-6">
          Shape has no accounts for learners. Most of what you do stays in your own browser. This page lists everything
          that doesn&apos;t, and how long it&apos;s kept.
        </p>

        <Section title="In your browser">
          <P>
            Your drafts, notebook, saved settings, lesson progress, and any API keys you add are stored in this
            browser&apos;s local storage. They never reach Shape&apos;s servers. Clearing your browser data removes
            them, and you can remove keys any time from <A href="/settings/keys">Keys</A>.
          </P>
        </Section>

        <Section title="Where your prompts go">
          <List>
            <li>
              <B>In-browser models.</B> The model downloads once and runs on your device. Prompts and answers never
              leave it.
            </li>
            <li>
              <B>Shape&apos;s free tier.</B> Prompts are sent from our server to Anthropic, which runs the model. We
              don&apos;t log or store the prompts or answers. To enforce the daily limit we keep a count of calls per
              day against an opaque code: a keyed hash of a random cookie, and of your IP address salted with the
              date. We never store your IP address itself, and the counts are deleted after {USAGE_COUNTER_DAYS} days.
            </li>
            <li>
              <B>Your own key.</B> Calls to Anthropic and Google go straight from your browser to them. Calls to
              OpenAI and Cerebras pass through a thin proxy on our server because those services block browser
              calls; your key and prompt are used for that one request and not logged or stored.
            </li>
          </List>
          <P>
            Whichever provider answers handles your prompt under its own policies, for example{" "}
            <A href="https://www.anthropic.com/legal/privacy" external>
              Anthropic&apos;s
            </A>
            .
          </P>
        </Section>

        <Section title="Sharing an experiment">
          <P>
            When you share an experiment, its design, prompts, every answer, and its manifest are stored on our
            server and published at an unlisted link. Anyone with the link can read it; it isn&apos;t listed or
            searchable. The page stays up until you delete it from the browser you shared it from. Your keys are
            never included.
          </P>
        </Section>

        <Section title="Classes">
          <List>
            <li>
              <B>Teachers</B> sign in with an email link. We store the email address and when you last signed in,
              and send sign-in emails through Resend. A sign-in lasts 30 days. You can delete your account, with every
              class and published result, from <A href="/teach">Teach</A>.
            </li>
            <li>
              <B>Students</B> join with a nickname they choose. No email or name is required. A cookie remembers
              them in that class for up to 180 days.
            </li>
            <li>
              <B>What&apos;s stored:</B> the class&apos;s experiment, each member&apos;s nickname, and every answer
              their runs produce, including the answer text. The teacher sees nicknames and answers. Classmates see
              the pooled results without nicknames.
            </li>
            <li>
              <B>How long:</B> a class closes when its teacher closes it, or automatically after {CLASS_IDLE_DAYS}{" "}
              days without activity. {CLASS_RETENTION_DAYS} days after it closes, the class, its members, and every
              answer are deleted for good.
            </li>
            <li>
              <B>Published results.</B> A teacher can publish a class&apos;s results as an unlisted page. It holds
              no nicknames, and it stays up after the class is deleted, until the teacher takes it down.
            </li>
          </List>
        </Section>

        <Section title="Analytics and feedback">
          <P>
            We use Vercel Web Analytics to count page views. It doesn&apos;t use cookies or track you across
            sites. If you send feedback with the Feedback button, your message, the page you were on, and your
            browser and screen size go to our issue tracker (Linear). Our host, Vercel, keeps standard request logs
            for a short time.
          </P>
        </Section>

        <Section title="Questions or deletion">
          <P>
            Teachers can delete their own account and everything in it from <A href="/teach">Teach</A>. To have
            anything else removed sooner, such as a shared page you can no longer delete from your browser, use the
            Feedback button and say what you&apos;d like removed. Shape is open source, so you can also{" "}
            <A href="https://github.com/jessholbrook/shape" external>
              read the code
            </A>{" "}
            that does all of this.
          </P>
          <P>
            Last updated <time dateTime="2026-11-03">3 November 2026</time>.
          </P>
        </Section>

        <p className="mt-12 font-sans text-[14px]">
          <Link href="/" className="text-ink underline decoration-highlight underline-offset-4 decoration-2">
            ← Back to Shape
          </Link>
        </p>
      </article>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[26px] md:text-[30px] leading-[1.15] tracking-tight text-ink">{title}</h2>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="font-sans text-[16px] leading-[1.65] text-ink-muted">{children}</p>;
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-medium text-ink">{children}</strong>;
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col gap-3 list-disc pl-5 font-sans text-[16px] leading-[1.65] text-ink-muted marker:text-ink-quiet">
      {children}
    </ul>
  );
}

function A({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls = "text-ink underline decoration-highlight underline-offset-4 decoration-2";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
