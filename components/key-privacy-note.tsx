const REPO_URL = "https://github.com/jessholbrook/shape";

/**
 * Honest, scannable explainer for how BYOK keys are handled. Shown wherever a
 * user is asked to paste a key (/start, /settings/keys).
 *
 * The OpenAI point is deliberately specific: those requests do pass through
 * our edge proxy, so we say so plainly rather than overclaiming "never touches
 * our server." The open-source line is the load-bearing one for a hesitant
 * first-time visitor — they can verify the claim instead of trusting it.
 */
export function KeyPrivacyNote() {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 md:p-7">
      <div className="flex items-center gap-2.5">
        <LockIcon />
        <h3 className="font-display text-[20px] md:text-[22px] leading-[1.15] text-ink">
          Your key stays in your browser.
        </h3>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        <Point>
          <strong>Saved locally, never on our servers.</strong> Your key lives
          in this browser&apos;s localStorage. Shape has no accounts and no
          database — there&apos;s nowhere on our side for it to land. Remove it
          in one click from Keys.
        </Point>
        <Point>
          <strong>Anthropic and Google go direct.</strong> Calls to Anthropic
          and Google Gemini run straight from your browser to their APIs. The
          key never passes through us.
        </Point>
        <Point>
          <strong>OpenAI takes one hop.</strong> OpenAI blocks calls made from a
          browser, so those requests pass through a thin proxy on our edge —
          your key is used for that one request in memory, never logged or
          stored.
        </Point>
        <Point>
          <strong>Don&apos;t take our word for it.</strong> Shape is{" "}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            open source
          </a>{" "}
          — read exactly what happens to your key.
        </Point>
      </ul>
    </div>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="font-sans text-[14px] leading-[1.6] text-ink-muted pl-5 relative">
      <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-highlight" />
      {children}
    </li>
  );
}

function LockIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-ink shrink-0"
      aria-hidden
    >
      <rect x="4.5" y="11" width="15" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
