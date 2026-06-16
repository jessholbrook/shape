import Link from "next/link";
import { getModuleByPlaygroundHref } from "@/lib/curriculum";

/**
 * Optional entry-point CTA at the top of each playground, pointing at the
 * concept article that frames what the playground teaches. Styled as an
 * offered choice — a quiet card with a highlight accent — so it catches the
 * eye of someone who wants the background first without nagging everyone
 * else. Renders nothing when there's no paired module.
 */
export function ConceptLink({ playgroundHref }: { playgroundHref: string }) {
  const mod = getModuleByPlaygroundHref(playgroundHref);
  if (!mod || mod.href === "#") return null;
  const label = `${mod.title}${mod.italic ? ` ${mod.italic}` : ""}`.trim();
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
