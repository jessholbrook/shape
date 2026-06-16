"use client";

import Link from "next/link";
import { getModuleByPlaygroundHref } from "@/lib/curriculum";
import { dismissConceptLink } from "@/lib/learn-progress";
import { useLearnProgress } from "@/lib/hooks/use-learn-progress";

/**
 * Optional entry-point CTA at the top of each playground, pointing at the
 * concept article that frames what the playground teaches. Three states:
 *   - Unvisited: highlight accent + invitation copy.
 *   - Visited:   greyed-out compact reminder with a × to dismiss.
 *   - Dismissed: renders nothing.
 * On the server (and during hydration) it always renders the unvisited state
 * to avoid a content shift before localStorage is readable.
 */
export function ConceptLink({ playgroundHref }: { playgroundHref: string }) {
  const mod = getModuleByPlaygroundHref(playgroundHref);
  const { hasRead, isConceptLinkDismissed, hydrated } = useLearnProgress();
  if (!mod || mod.href === "#") return null;

  const dismissed = hydrated && isConceptLinkDismissed(mod.slug);
  if (dismissed) return null;

  const visited = hydrated && hasRead(mod.slug);
  const label = `${mod.title}${mod.italic ? ` ${mod.italic}` : ""}`.trim();

  if (visited) {
    return (
      <div className="mt-6 inline-flex items-center gap-1.5 max-w-full">
        <Link
          href={mod.href}
          className="inline-flex items-center gap-3 bg-surface border border-line border-l-[3px] border-l-line/80 rounded-[10px] pl-3.5 pr-4 py-2 hover:border-ink-quiet transition-colors group"
        >
          <span className="font-sans text-[14px] leading-[1.4] text-ink-quiet">
            Revisit{" "}
            <span className="italic font-medium text-ink-muted">{label}</span>
          </span>
          <span className="font-mono text-[14px] text-ink-quiet shrink-0 transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
        <button
          type="button"
          onClick={() => dismissConceptLink(mod.slug)}
          aria-label="Dismiss this hint"
          className="w-7 h-7 inline-flex items-center justify-center text-ink-quiet hover:text-ink-muted text-[18px] leading-none rounded-full"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <Link
      href={mod.href}
      className="mt-6 inline-flex items-center gap-3 bg-surface border border-line border-l-[3px] border-l-highlight rounded-[10px] pl-3.5 pr-4 py-2.5 hover:border-ink-muted hover:border-l-highlight transition-colors group max-w-full"
    >
      <span className="font-sans text-[14px] leading-[1.4] text-ink-muted">
        New here? Read about{" "}
        <span className="italic font-medium text-ink">{label}</span> first — the
        concept this playground walks you through.
      </span>
      <span className="font-mono text-[14px] text-highlight shrink-0 transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
