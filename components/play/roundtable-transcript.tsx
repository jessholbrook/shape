"use client";

import {
  STANCE_LABEL,
  parseStance,
  parseWhisper,
  publicText,
  seatName,
  type Seat,
  type Stance,
  type Turn,
} from "@/lib/roundtable";

/**
 * The shared transcript, round by round, exactly as the seats read it —
 * speaker-labelled, in speaking order — with each turn's stance read off its
 * last line. A turn with no stance line says so rather than guessing.
 */
export function RoundtableTranscript({ turns, seats }: { turns: Turn[]; seats: Seat[] }) {
  if (turns.length === 0) return null;
  const rounds = [...new Set(turns.map((t) => t.round))].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((r) => (
        <div key={r} className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">Round {r}</p>
          {turns
            .filter((t) => t.round === r)
            .map((t, i) => {
              const stance = t.status === "done" ? parseStance(t.text) : null;
              return (
                <div key={`${t.seatId}-${i}`} className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <span className="font-display text-[15px] leading-[1.2] text-ink">
                      {seatName(seats, t.seatId)}
                    </span>
                    {t.status === "running" && (
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                        Speaking…
                      </span>
                    )}
                    {t.status === "done" && <StancePill stance={stance} />}
                  </div>
                  {t.status === "error" ? (
                    <p className="font-mono text-[12px] text-danger break-words">{t.error ?? "Failed."}</p>
                  ) : (
                    <p className="font-sans text-[14px] leading-[1.55] text-ink whitespace-pre-wrap break-words">
                      {t.status === "done" ? publicText(t.text) : t.text}
                    </p>
                  )}
                  {t.status === "done" && parseWhisper(t.text) && (
                    <p className="font-sans text-[13px] leading-[1.5] text-highlight-ink italic border-l-2 border-highlight pl-3">
                      whispered to {parseWhisper(t.text)!.toName}: {parseWhisper(t.text)!.message}
                    </p>
                  )}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

export function StancePill({ stance }: { stance: Stance | null }) {
  const tone =
    stance === "for"
      ? "bg-success/15 text-success"
      : stance === "against"
        ? "bg-danger/10 text-danger"
        : stance === "undecided"
          ? "bg-highlight-soft text-highlight-ink"
          : "bg-line/60 text-ink-quiet";
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}>
      {stance ? STANCE_LABEL[stance] : "No stance"}
    </span>
  );
}
