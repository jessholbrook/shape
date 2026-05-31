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
  TryItCTA,
  UL,
} from "@/components/learn/article";
import { MarkAsRead } from "@/components/learn/mark-as-read";

const SLUG = "voice-and-tone";

export const metadata = {
  title: "Voice & tone",
  description:
    "Style is composable. Move warmth, verbosity, energy, directness as independent dials.",
};

export default function VoiceAndTonePage() {
  const mod = getModule(SLUG)!;
  const next = nextModule(SLUG);

  return (
    <Shell>
      <article className="mx-auto max-w-[760px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArticleHeader module={mod} />

        <Lede>
          Tone isn&apos;t one thing. It&apos;s warmth, verbosity, energy,
          directness — turning independently. Once you can name the dials,
          you can move them.
        </Lede>

        <H2>The familiar move</H2>
        <P>
          The best brand-voice guides separate voice from tone. Voice is
          who the brand is — it doesn&apos;t change between an empty state
          and a payment confirmation. Tone is how voice shows up in a
          situation: a little more careful in error states, a little more
          warm in onboarding. Same identity, different settings.
        </P>
        <P>
          That separation is the whole reason those guides work. Without
          it, every piece of copy gets reviewed against an undifferentiated
          vibe and everyone disagrees about whether it&apos;s right.
        </P>

        <H2>The lesson, stated plainly</H2>
        <P>
          Most prompt-writing treats tone as a single slider: more warm,
          less formal, less stiff. The problem is that &ldquo;warm&rdquo;
          isn&apos;t actually one thing. It&apos;s warmth toward the
          reader, plus a particular kind of energy, plus a willingness to
          take up some space, plus a hedging style. Conflate them and you
          end up writing &ldquo;be warmer&rdquo; and getting back something
          chirpy when you wanted something steady.
        </P>
        <P>
          Treat tone as composable: name the dimensions, move them one at
          a time, watch what each one does on its own. The point isn&apos;t
          to use every dial — most outputs need two or three to land. The
          point is that you can pick.
        </P>

        <H2>A small example</H2>
        <ExampleBlock>
          <ExampleCard
            label="Warm, composed"
            promptLabel="Dials"
            prompt={`Warmth: Warm
Energy: Composed
Verbosity: Brief
Directness: Direct
(others at neutral)`}
            outputLabel="Output"
            output="Welcome. Take your time getting set up — you can change any of these later."
            note="Warmth + composure together read as 'grown-up and kind.' Good for a calm onboarding moment."
          />
          <ExampleCard
            label="Warm, playful"
            promptLabel="Dials"
            prompt={`Warmth: Warm
Energy: Playful
Verbosity: Brief
Directness: Direct
(others at neutral)`}
            outputLabel="Output"
            output="Hey, glad you made it! Set things up however you like — we can always shuffle them later."
            note="Same warmth, more energy. Now it reads as 'friend at the door,' for better or worse. Both could be right; they're for different products."
          />
        </ExampleBlock>
        <P>
          One dial moved. Same warmth on both sides — but the energy dial
          changed what warmth actually feels like in the output. That&apos;s
          the lesson: composability isn&apos;t a coding trick, it&apos;s a
          way of seeing.
        </P>

        <H2>Why this is the foundation</H2>
        <P>
          Once you can name the dials, tone stops being a matter of taste
          and starts being a specification. You can hand someone a tone
          spec the same way you&apos;d hand them a color spec. They can
          argue with it. You can change one variable and explain why. The
          new copy that comes back is comparable to the old copy.
        </P>
        <P>
          Three things to watch for when you tune one:
        </P>
        <UL>
          <LI>
            <strong>Reaching for one dial when you wanted another.</strong>{" "}
            If &ldquo;warm&rdquo; isn&apos;t landing, the answer might be
            in Directness or Energy, not Warmth.
          </LI>
          <LI>
            <strong>Stacking too many.</strong> Three dials off neutral is
            already a strong tone. All five and the output starts to read
            as a character, not a voice.
          </LI>
          <LI>
            <strong>Forgetting the brief.</strong> Tone shapes a task;
            it doesn&apos;t replace one. If the dials are doing too much
            work, you&apos;re probably under-specifying the role.
          </LI>
        </UL>

        <TryItCTA
          href={mod.playground?.href ?? "/play/tone"}
          buttonLabel="Open Tone Dial"
        >
          Open Tone Dial and{" "}
          <span className="italic">move one dimension</span>.
        </TryItCTA>

        <H2>What to take into the playground</H2>
        <UL>
          <LI>
            Start at all-neutral. Read the baseline output. That&apos;s the
            voice underneath your tone choices.
          </LI>
          <LI>
            Move <em>one dial</em> two stops at a time. Smaller changes
            don&apos;t move the output noticeably enough to learn from.
          </LI>
          <LI>
            When a combination feels right, save the draft. The dial
            position is the spec — that&apos;s what you can hand off.
          </LI>
        </UL>

        <NextModuleFooter next={next} />
        <MarkAsRead slug={SLUG} />
      </article>
    </Shell>
  );
}
