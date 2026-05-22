"use client";

import Link from "next/link";
import { useKeys } from "@/lib/hooks/use-keys";
import { useUsage } from "@/lib/hooks/use-usage";
import { PROVIDER_LIST } from "@/lib/providers";

function formatUsd(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

export function CostMeter() {
  const { keys, hydrated, hasAnyKey } = useKeys();
  const { summary } = useUsage();

  if (!hydrated) {
    return (
      <div className="bg-surface border border-line rounded-[12px] p-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Loading
        </div>
        <div className="mt-1 h-5" />
      </div>
    );
  }

  if (!hasAnyKey) {
    return (
      <Link
        href="/settings/keys"
        className="block group bg-surface border border-line rounded-[12px] p-3 hover:border-ink transition-colors"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          No key yet
        </div>
        <div className="font-display text-[16px] leading-[1.2] text-ink mt-1">
          Bring a key →
        </div>
        <div className="font-sans text-[11px] text-ink-muted mt-1">
          Set up to run playgrounds.
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/settings/keys"
      className="block bg-surface border border-line rounded-[12px] p-3 hover:border-ink transition-colors"
      title={`${summary.callCount} calls today`}
    >
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Today
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {formatTokens(summary.totalTokens)} tok
        </div>
      </div>
      <div className="font-display text-[22px] leading-[1.1] text-ink mt-1">
        {formatUsd(summary.totalCost)}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {PROVIDER_LIST.map((p) => {
          const connected = !!keys[p.id];
          const hasUsage = !!summary.byProvider[p.id]?.calls;
          return (
            <span
              key={p.id}
              className={`flex-1 h-1 rounded-full ${
                hasUsage
                  ? "bg-highlight"
                  : connected
                  ? "bg-highlight/40"
                  : "bg-line"
              }`}
              title={`${p.name}: ${
                connected ? "connected" : "not connected"
              }${hasUsage ? ` — ${formatUsd(summary.byProvider[p.id]!.cost)}` : ""}`}
            />
          );
        })}
      </div>
    </Link>
  );
}
