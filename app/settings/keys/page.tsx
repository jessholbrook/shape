import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { KeySetupForm } from "@/components/key-setup-form";

export const metadata = {
  title: "Keys — Shape",
  description: "Bring your own keys. They stay in your browser.",
};

export default function KeysPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[860px] px-6 md:px-12 pt-16 md:pt-24 pb-32">
        <SectionNumber label="Setup">00</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[72px] leading-[1.0] tracking-tight text-ink mt-6">
          Bring <span className="italic">your</span> keys.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-6 max-w-xl">
          Shape is BYOK by design. Your keys live in your browser&apos;s
          localStorage and are sent directly to the provider when you run a
          playground. They never touch our server.
        </p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Reassurance
            title="In your browser."
            body="localStorage only. Closing the tab keeps the key; clearing site data removes it."
          />
          <Reassurance
            title="Never persisted server-side."
            body="Anthropic calls go straight from your browser. OpenAI requests pass through our edge proxy in memory only — never logged or stored."
          />
          <Reassurance
            title="You see every cost."
            body="A meter in the nav tracks tokens and estimated $ per provider."
          />
        </div>

        <div className="mt-16">
          <KeySetupForm />
        </div>

        <div className="mt-16 border-t border-line pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            Pricing reference
          </p>
          <p className="font-sans text-[14px] text-ink-muted mt-3 max-w-xl">
            Estimated costs use{" "}
            <a
              href="https://www.anthropic.com/pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Anthropic
            </a>{" "}
            and{" "}
            <a
              href="https://openai.com/api/pricing/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              OpenAI
            </a>{" "}
            published rates. Actual charges come from the provider, not us.
          </p>
        </div>
      </section>
    </Shell>
  );
}

function Reassurance({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-surface border border-line rounded-[12px] p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-highlight" />
        <h3 className="font-display text-[18px] leading-[1.2] text-ink">
          {title}
        </h3>
      </div>
      <p className="font-sans text-[13px] leading-[1.5] text-ink-muted">
        {body}
      </p>
    </div>
  );
}
