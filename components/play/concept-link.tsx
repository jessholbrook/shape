import Link from "next/link";
import { getModuleByPlaygroundHref } from "@/lib/curriculum";

/**
 * Small caption-style link from a playground back to its matching curriculum
 * article. Renders nothing when there's no paired module or the article isn't
 * live yet.
 */
export function ConceptLink({ playgroundHref }: { playgroundHref: string }) {
  const mod = getModuleByPlaygroundHref(playgroundHref);
  if (!mod || mod.href === "#") return null;
  return (
    <Link
      href={mod.href}
      className="mt-6 inline-flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
    >
      <span>
        Read the concept — {mod.title}
        {mod.italic ? ` ${mod.italic}` : ""}
      </span>
      <span className="text-highlight">→</span>
    </Link>
  );
}
