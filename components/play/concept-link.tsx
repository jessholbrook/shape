import Link from "next/link";
import { getModuleByPlaygroundHref } from "@/lib/curriculum";

/**
 * Entry-point CTA at the top of each playground, pointing at the concept
 * article that frames what the playground teaches. Uses the highlight palette
 * to draw enough attention that a first-time visitor sees it without it
 * shouting like a banner. Renders nothing when there's no paired module.
 */
export function ConceptLink({ playgroundHref }: { playgroundHref: string }) {
  const mod = getModuleByPlaygroundHref(playgroundHref);
  if (!mod || mod.href === "#") return null;
  const label = `${mod.title}${mod.italic ? ` ${mod.italic}` : ""}`.trim();
  return (
    <Link
      href={mod.href}
      className="mt-6 inline-flex items-center gap-3 bg-highlight-soft border border-highlight/40 rounded-[12px] px-4 py-3 hover:bg-highlight/15 transition-colors group max-w-full"
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink/80 shrink-0">
        Before you start
      </span>
      <span className="font-sans text-[14px] leading-[1.4] text-ink">
        Read about <span className="italic font-medium">{label}</span> — the
        concept this playground teaches
      </span>
      <span className="font-mono text-[14px] text-highlight shrink-0 transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
