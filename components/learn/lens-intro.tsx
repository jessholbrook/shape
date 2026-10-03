"use client";

import Link from "next/link";
import { LENSES } from "@/lib/lenses";
import { lessonIntro } from "@/lib/lens-intros";
import { useLens } from "@/lib/hooks/use-lens";

/**
 * The reader's own "what you already know", above a lesson written with
 * product-design examples. Renders nothing without a lens (or for UX, which
 * the lessons already speak to).
 */
export function LensIntro({ slug }: { slug: string }) {
  const { lens } = useLens();
  const intro = lessonIntro(lens, slug);
  if (!lens || !intro) return null;

  return (
    <aside
      aria-label={`For ${LENSES[lens].name.toLowerCase()}`}
      className="mt-10 border-l-2 border-highlight pl-5"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Reading as {LENSES[lens].name.toLowerCase()} ·{" "}
        <Link href="/#lenses" className="underline underline-offset-4 hover:text-ink">
          change
        </Link>
      </p>
      <p className="mt-3 font-sans text-[17px] leading-[1.6] text-ink">{intro}</p>
      <p className="mt-3 font-sans text-[14px] leading-[1.55] text-ink-muted">
        The examples below come from product design. The move is the same.
      </p>
    </aside>
  );
}
