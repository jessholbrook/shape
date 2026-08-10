"use client";

import {
  formatMs,
  totalMs,
  ttftMs,
  type RaceResult,
} from "@/lib/race";

/**
 * Two bars on a shared time axis — the fastest way to see the gap. Each bar
 * splits into the wait before the first token and the generation that follows,
 * because those are different failure modes: a long wait feels broken, a long
 * generation just feels thorough.
 *
 * Bars are scaled to whichever lane took longest, so the slower one always
 * fills the track and the faster one reads as a fraction of it.
 */
export function RaceTimeline({
  a,
  b,
  labelA,
  labelB,
}: {
  a: RaceResult;
  b: RaceResult;
  labelA: string;
  labelB: string;
}) {
  const maxMs = Math.max(totalMs(a) ?? 0, totalMs(b) ?? 0);
  if (maxMs <= 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Timeline
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          <span className="inline-block w-2 h-2 rounded-sm bg-ink-quiet align-middle mr-1" />
          wait
          <span className="inline-block w-2 h-2 rounded-sm bg-highlight align-middle ml-3 mr-1" />
          generating
        </span>
      </div>
      <Bar result={a} label={labelA} maxMs={maxMs} />
      <Bar result={b} label={labelB} maxMs={maxMs} />
    </div>
  );
}

function Bar({
  result,
  label,
  maxMs,
}: {
  result: RaceResult;
  label: string;
  maxMs: number;
}) {
  const total = totalMs(result);
  const ttft = ttftMs(result);

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet w-14 shrink-0">
        {label}
      </span>
      <span className="flex-1 h-3 rounded-full bg-line/50 overflow-hidden flex">
        {total != null && ttft != null && (
          <>
            <span
              className="h-full bg-ink-quiet"
              style={{ width: `${(ttft / maxMs) * 100}%` }}
            />
            <span
              className="h-full bg-highlight"
              style={{ width: `${((total - ttft) / maxMs) * 100}%` }}
            />
          </>
        )}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-ink w-16 text-right shrink-0">
        {formatMs(total)}
      </span>
    </div>
  );
}
