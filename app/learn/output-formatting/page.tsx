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

const SLUG = "output-formatting";

export const metadata = {
  title: "Output formatting",
  description:
    "Lists, headings, JSON, paragraphs. Format is part of voice; pick one on purpose.",
};

export default function OutputFormattingPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          Format isn&apos;t neutral. A bulleted list and a paragraph carry
          the same content but a different relationship with the reader.
          Format is part of voice.
        </Lede>

        <H2>Why this is the foundation</H2>
        <P>
          Format composes with everything else you&apos;ve been designing.
          A warm persona giving you a bulleted list still feels distant
          because the format is doing the wrong work. A blunt persona
          writing flowing prose feels less blunt because the format
          softens it. Format and tone aren&apos;t separable — they reach
          the reader together.
        </P>
        <P>
          A few specific moves that pay off:
        </P>
        <UL>
          <LI>
            <strong>Say &ldquo;no lists&rdquo; when you mean it.</strong>{" "}
            The model defaults to lists for almost anything that could be
            structured. If you want prose, the easiest fix is one
            sentence in the system prompt.
          </LI>
          <LI>
            <strong>Specify length, not just shape.</strong> &ldquo;Short
            paragraph&rdquo; is more useful than &ldquo;short.&rdquo;
            &ldquo;Three sentences&rdquo; is more useful than &ldquo;short
            paragraph.&rdquo;
          </LI>
          <LI>
            <strong>Match the format to the channel.</strong> A toast
            notification, a long-form email, and a chat reply have
            different shapes. The system prompt should know which one
            it&apos;s producing.
          </LI>
          <LI>
            <strong>Read what comes out, not what you asked for.</strong>{" "}
            If the model keeps reaching for headings when you asked for
            prose, the rule went into the system prompt softly. Make it
            louder.
          </LI>
        </UL>

        <H2>The familiar move</H2>
        <P>
          You make format choices constantly. Where to break a paragraph,
          when to use a list, when to drop in a heading, when to push a
          warning into a callout. Every one of those is a small claim
          about how the reader should navigate the page.
        </P>
        <P>
          The same content, restructured, reads as a different document.
          A long paragraph treats the reader as someone who&apos;ll sit
          with the idea. A four-bullet list treats them as someone who
          needs to scan. Neither is wrong. Picking the right one is
          design.
        </P>

        <H2>The lesson</H2>
        <P>
          Most language models default to a few formats — bulleted lists
          with bolded prefixes, numbered steps, headings every two
          paragraphs. They&apos;re the safest-looking defaults, which is
          why models reach for them. They&apos;re also wrong a lot of the
          time. A heartfelt support reply doesn&apos;t want bullets. A
          checklist doesn&apos;t want flowing prose.
        </P>
        <P>
          The fix isn&apos;t to scold the model in your system prompt.
          The fix is to specify the format on purpose: &ldquo;answer in
          one short paragraph, no lists.&rdquo; Format becomes another
          knob in the system prompt, sitting next to voice and persona.
          Once you treat it that way, the output starts behaving.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Default — full structure"
            promptLabel="Format instruction"
            prompt="(none — model picks)"
            outputLabel="Output"
            output={`## Interview Prep Checklist

**Opening**
- 🤝 **Build rapport first.** Don't dive into the first question.
- ❌ **Avoid leading questions.** No "Don't you think…?"

**Questioning**
- 1️⃣ **One thing at a time.** No compound questions.
- 🤫 **Let silence do the work.** Don't fill the gap.

**Note-taking**
- ✍️ **Hand-written notes** > typing.
- 💬 **Capture verbatim quotes** at key moments.

**Key Reminders**
1. Watch body language
2. Follow the participant's lead
3. End on time`}
            note={
              <>
                Headings, bullets, sub-bullets, bold prefixes, emoji,
                numbered footers. Looks competent and{" "}
                <NoteAccent>reads like a wiki page.</NoteAccent>
              </>
            }
          />
          <ExampleCard
            label="Prose, on purpose"
            promptLabel="Format instruction"
            prompt="Reply in one short paragraph. No lists, no headings, no bold."
            outputLabel="Output"
            output="Honestly, just be a person for the first minute. Don't dive into the first question — let them get settled. When you start asking things, ask one thing at a time, and resist filling silences; most people will tell you what they actually meant if you wait. Take notes by hand if you can. It changes how you listen."
            note={
              <>
                Same content, different posture.{" "}
                <NoteAccent>
                  Sounds like a person leaning in, not a doc.
                </NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          Same persona, probably. Same five points. The format is doing
          all of the work to move the output from &ldquo;reference
          material&rdquo; to &ldquo;something someone said.&rdquo;
        </P>

        <H2>Try it in your own work</H2>
        <P>
          This one doesn&apos;t pair with a single playground — format
          shows up everywhere. The fastest way to feel it is in Diff
          Mode: write the same user message, set Config A to a system
          prompt that says nothing about format, set Config B to one
          that specifies it on purpose. Read both. You&apos;ll see how
          much of the output you were assigning to &ldquo;voice&rdquo;
          was actually formatting choices.
        </P>

        <TryItCTA href="/play/diff" buttonLabel="Open Diff Mode">
          Open Diff Mode and{" "}
          <span className="italic">give format its own config</span>.
        </TryItCTA>

        <P>
          Then carry that habit into the rest of your work. The next time
          you&apos;re tuning a system prompt, the question to ask
          isn&apos;t just <em>what</em> the model should say — it&apos;s
          what shape that answer should take.
        </P>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
