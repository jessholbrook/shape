import Link from "next/link";
import type { Bridge } from "@/lib/lenses";

export function BridgeCard({ kicker, statement, href }: Bridge) {
  return (
    <Link
      href={href}
      className="group block bg-surface border border-line rounded-[16px] p-6 md:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center font-mono text-[12px] bg-highlight-soft text-highlight-ink rounded-full px-3 py-1">
          {href}
        </span>
        <span className="font-mono text-[12px] text-ink-quiet group-hover:text-highlight transition-colors">
          →
        </span>
      </div>
      <p className="font-display text-[22px] md:text-[26px] leading-[1.2] text-ink mt-6">
        <span className="text-ink-quiet">{kicker}</span> {statement}
      </p>
    </Link>
  );
}
