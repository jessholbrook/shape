"use client";

import Link from "next/link";
import { lensContent, LENSES } from "@/lib/lenses";
import { useLens } from "@/lib/hooks/use-lens";
import { LensPicker } from "@/components/lens-picker";
import { BridgeCard } from "./bridge-card";

/** The home page's bridge section, framed for the reader's lens. */
export function LensBridges() {
  const { lens } = useLens();
  const content = lensContent(lens);

  return (
    <>
      <h2 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6 max-w-3xl">
        {content.bridgeHeading.before}{" "}
        <span className="italic">{content.bridgeHeading.italic}</span>.
      </h2>
      <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-5 max-w-2xl">
        {content.bridgeIntro}
      </p>

      <div className="mt-8">
        <LensPicker />
      </div>

      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {content.bridges.map((b) => (
          <BridgeCard key={b.href + b.kicker} {...b} />
        ))}
      </div>

      {lens && (
        <p className="mt-8 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet">
          <Link
            href={`/for/${lens}`}
            className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            A suggested path for {LENSES[lens].name.toLowerCase()} →
          </Link>
        </p>
      )}
    </>
  );
}
