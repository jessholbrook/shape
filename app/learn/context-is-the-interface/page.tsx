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

const SLUG = "context-is-the-interface";

export const metadata = {
  title: "Context is the interface",
  description:
    "Your system prompt is a fraction of what the model reads. The rest arrives at runtime, from systems nobody designed.",
};

export default function ContextPage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          You have spent your time editing the one part of the prompt you can
          see. Most of what the model reads shows up at runtime, and somebody
          else decided what it says.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          You have done a content audit. You know the hard problem in a content
          system isn&apos;t writing — it&apos;s that old pages never die. A
          help article from 2019 is still live, still indexed, still ranking,
          and a customer finds it and believes it, because it&apos;s on your
          domain in your voice with your logo at the top.
        </P>
        <P>
          Nothing failed there. Search worked. The page loaded. The copy was
          well written when it was written. The failure was that nobody owned
          the question of what should stop being findable.
        </P>
        <P>
          That is the whole of this module. A language model with retrieval is
          that same system, with two changes: it doesn&apos;t show you a URL,
          and it doesn&apos;t show you a date. It just tells you the answer.
        </P>

        <H2>What&apos;s actually in the window</H2>
        <P>
          Your system prompt is one block of text in a much larger payload.
          Alongside it, on every single call, some combination of: retrieved
          documents, the transcript so far, text the user pasted in, a summary
          of who they are, results from tools the model called a moment ago.
        </P>
        <P>
          In the example this module ships with — a support assistant, three
          short documents — the system prompt is about a quarter of what the
          model reads. In a production assistant with real retrieval it is
          routinely a few percent. You are editing the small part.
        </P>
        <P>
          Which makes the real design surface the part you probably
          haven&apos;t been shown: <strong>what gets retrieved, from where,
          how much of it, in what order, and what never gets retired.</strong>{" "}
          That surface exists in every AI product. It usually has no designer
          on it.
        </P>

        <H2>Three ways it goes wrong</H2>
        <P>
          Each of these produces a fluent, on-brand, confident answer. That is
          the thing worth sitting with — none of them looks like an error.
        </P>
        <UL>
          <LI>
            <strong>Nothing was retrieved.</strong>{" "}
            The model answers from its
            own weights. Sometimes that&apos;s right. Sometimes it&apos;s a
            plausible average of the whole internet, delivered in your brand
            voice.
          </LI>
          <LI>
            <strong>The wrong thing was retrieved.</strong>{" "}
            The 2019 policy is
            still in the index. It comes back, it&apos;s coherent, it&apos;s
            specific, and it&apos;s wrong. This is the dangerous one, because
            the system is working exactly as built.
          </LI>
          <LI>
            <strong>Someone else&apos;s text was retrieved.</strong>{" "}
            A pasted
            email, a scraped page, a forwarded ticket. If it contains something
            shaped like an instruction, the model may follow it.
          </LI>
        </UL>

        <H2>Why that last one happens</H2>
        <P>
          It&apos;s tempting to read prompt injection as a bug someone will
          patch. It isn&apos;t. It falls out of the shape of the thing.
        </P>
        <P>
          <NoteAccent>The model has one channel.</NoteAccent>{" "}
          Everything —
          your instructions, the retrieved doc, the user&apos;s question, the
          forwarded email — arrives as text in one window. &ldquo;This part is
          data, that part is a command&rdquo; is a convention you assert in
          words, not a boundary the system enforces. A sufficiently
          instruction-shaped sentence in a document you didn&apos;t write can
          read, to the model, exactly like a sentence you did.
        </P>
        <P>
          You can make it less likely — label sources, tell the model that
          content between markers is quoted material and never an instruction,
          keep untrusted text out of the same turn where you can. None of that
          is a guarantee, and designing as though it were is the mistake.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Retrieval working"
            promptLabel="Context"
            prompt={`[Retention policy — current]
Deleted photos sit in Trash and are
permanently removed after 30 days.`}
            outputLabel="Answer"
            output="They stay in Trash for 30 days, then they're permanently removed."
            note={
              <>
                Correct, sourced, and traceable — you can point at the sentence
                it came from.
              </>
            }
          />
          <ExampleCard
            label="Retrieval also working"
            promptLabel="Context"
            prompt={`[Retention policy — current]
…removed after 30 days.

[Retention policy — archived, 2019]
…removed after 7 days.`}
            outputLabel="Answer"
            output="Deleted photos are removed after 7 days."
            note={
              <>
                Nothing broke. Search ran, a real document came back, the model
                summarised it accurately.{" "}
                  <NoteAccent>
                  The answer is wrong and carries no date.
                </NoteAccent>
              </>
            }
          />
        </ExampleBlock>
        <P>
          Two answers, same question, same prompt, same model. The only
          difference is which documents were in the window — and that
          difference is invisible in the output.
        </P>

        <H2>Prior turns are context too</H2>
        <P>
          One more thing that lives in the window: the conversation itself.
          Everything the model said three turns ago is still there, being read
          again, on equal footing with your instructions. A wrong claim it
          made early doesn&apos;t get corrected by later turns — it gets
          re-read as established fact.
        </P>
        <P>
          You&apos;ve seen the symptom in <em>Multi-turn flows</em>{" "}
          if the model drifted and never came back. This is the mechanism.
        </P>

        <H2>What you can actually do</H2>
        <UL>
          <LI>
            <strong>Ask to see the assembled prompt.</strong>{" "}
            Not the system
            prompt — the whole payload, for a real query. If nobody on the team
            can show it to you, that is itself the finding.
          </LI>
          <LI>
            <strong>Audit the index like a content library.</strong>{" "}
            What is in
            there, how old is it, who owns retiring it? Writing the new doc is
            the easy half.
          </LI>
          <LI>
            <strong>Ask for attribution, not confidence.</strong>{" "}
            If an answer
            can&apos;t be traced to a source, treat it as unsourced —
            regardless of how assured it sounds.
          </LI>
          <LI>
            <strong>Design the provenance into the interface.</strong>{" "}
            A date,
            a source name, a link. The model won&apos;t volunteer any of it,
            and the user has no other way to tell a current answer from an
            archived one.
          </LI>
        </UL>

        <TryItCTA
          href={mod.playground?.href ?? "/play/context"}
          buttonLabel="Open Context Lab"
        >
          Ask one question four ways and{" "}
        <span className="italic">watch the answer change</span>.
        </TryItCTA>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Run the seeded sets unchanged first. Four context sets, one
            question. Read the four answers before you read the verdicts.
          </LI>
          <LI>
            Open &ldquo;what the model reads&rdquo; on each card and watch the
            system-prompt percentage fall as sources go in. That number is the
            module in one figure.
          </LI>
          <LI>
            Look hardest at the injected set. Notice that it&apos;s often the
            friendliest, most reassuring answer on the page — which is exactly
            why it would survive a review.
          </LI>
          <LI>
            Then bring your own: paste in two versions of a real policy from
            your own product, one current and one you thought was dead. Give
            each a tell. Find out which one the model prefers.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
