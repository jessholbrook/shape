import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { KeySetupForm } from "@/components/key-setup-form";
import { KeyPrivacyNote } from "@/components/key-privacy-note";
import { LocalModelStorage } from "@/components/local-model-storage";
import { WebLLMDisclosure } from "@/components/webllm-disclosure";

export const metadata = {
  title: "Keys",
  description: "Bring your own keys. They stay in your browser.",
};

export default function KeysPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[860px] px-6 md:px-12 pt-16 md:pt-24 pb-32">
        <SectionNumber>00</SectionNumber>

        <h1 className="font-display text-[48px] md:text-[72px] leading-[1.0] tracking-tight text-ink mt-6">
          Bring <span className="italic">your</span> keys.
        </h1>

        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-6 max-w-xl">
          Shape is BYOK by design — and prefers no key at all. The free
          in-browser models need nothing here. If you do bring a key, this is
          how it&apos;s handled:
        </p>

        <div className="mt-10">
          <KeyPrivacyNote />
        </div>

        <div className="mt-16">
          <KeySetupForm />
        </div>

        <div className="mt-16 border-t border-line pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            In-browser model
          </p>
          <p className="font-sans text-[14px] text-ink-muted mt-3 max-w-xl">
            The Free option downloads a small open model into this browser
            the first time you open a playground. Here&apos;s what it is and
            how to wipe it.
          </p>
          <div className="mt-5">
            <WebLLMDisclosure />
          </div>
          <div className="mt-5">
            <LocalModelStorage />
          </div>
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
