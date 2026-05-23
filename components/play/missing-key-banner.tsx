"use client";

import Link from "next/link";

/**
 * The vermillion-on-soft banner that surfaces at the top of a playground or
 * studio when the visitor hasn't connected a key for the selected provider.
 * Renders nothing when `show` is false so callers can pass
 * `hydrated && !ready` straight through without a wrapping conditional.
 */
export function MissingKeyBanner({
  show,
  providerName,
  action,
}: {
  show: boolean;
  /** Human label, e.g. "Anthropic" or "OpenAI". */
  providerName: string;
  /** Verb phrase completing "Add one to {action}." — e.g. "test the persona". */
  action: string;
}) {
  if (!show) return null;
  return (
    <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
      <p className="font-sans text-[14px] text-ink">
        You&apos;re missing a key for{" "}
        <span className="font-mono text-[13px]">{providerName}</span>. Add one
        to {action}.
      </p>
      <Link
        href="/settings/keys"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
      >
        Set up keys →
      </Link>
    </div>
  );
}
