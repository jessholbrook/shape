"use client";

import {
  formatFactor,
  type Comparison,
  type LaneId,
  type RaceVerdict,
} from "@/lib/race";

/**
 * The headline, and the point of the playground.
 *
 * It states the speed and cost gap as plain multiples and then immediately
 * asks which one you'd ship. That order matters: the numbers are the easy
 * part, and a designer who reads them without being made to decide will
 * default to the better-sounding model every time. Forcing the pick — and
 * saving it as part of the artifact — is what turns a stopwatch into a
 * design exercise.
 */
export function RaceVerdictPanel({
  verdict,
  labelA,
  labelB,
  pick,
  onPick,
  pickNote,
  onPickNoteChange,
}: {
  verdict: RaceVerdict;
  labelA: string;
  labelB: string;
  pick: LaneId | null;
  onPick: (next: LaneId | null) => void;
  pickNote: string;
  onPickNoteChange: (next: string) => void;
}) {
  if (!verdict.complete) return null;

  const nameOf = (id: LaneId) => (id === "a" ? labelA : labelB);

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-4">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        Verdict
      </span>

      <h2 className="font-display text-[24px] md:text-[30px] leading-[1.15] text-ink">
        <Headline verdict={verdict} nameOf={nameOf} />
      </h2>

      <div className="border-t border-line pt-4 flex flex-col gap-3">
        <p className="font-sans text-[15px] leading-[1.5] text-ink">
          Now read both outputs. Which would you actually ship?
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <PickButton
            active={pick === "a"}
            onClick={() => onPick(pick === "a" ? null : "a")}
          >
            {labelA}
          </PickButton>
          <PickButton
            active={pick === "b"}
            onClick={() => onPick(pick === "b" ? null : "b")}
          >
            {labelB}
          </PickButton>
        </div>
        {pick && (
          <textarea
            value={pickNote}
            onChange={(e) => onPickNoteChange(e.target.value)}
            rows={2}
            placeholder="Why? What was the slower one actually better at — and was it worth it?"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
          />
        )}
      </div>
    </div>
  );
}

function Headline({
  verdict,
  nameOf,
}: {
  verdict: RaceVerdict;
  nameOf: (id: LaneId) => string;
}) {
  const parts: React.ReactNode[] = [];

  if (verdict.speed?.winner) {
    parts.push(
      <span key="speed">
        {nameOf(verdict.speed.winner)} finished{" "}
        <span className="text-highlight-ink">
          {formatFactor(verdict.speed.factor)} faster
        </span>
      </span>,
    );
  }

  if (verdict.cost?.winner) {
    const sameWinner =
      verdict.speed?.winner && verdict.speed.winner === verdict.cost.winner;
    parts.push(
      <span key="cost">
        {parts.length > 0 ? (sameWinner ? " and " : " — but ") : ""}
        {parts.length > 0 && !sameWinner ? `${nameOf(verdict.cost.winner)} ` : ""}
        cost{" "}
        <span className="text-highlight-ink">
          {formatFactor(verdict.cost.factor)} less
        </span>
        {parts.length === 0 ? ` in ${nameOf(verdict.cost.winner)}` : ""}
      </span>,
    );
  }

  if (parts.length === 0) {
    return <>Both lanes came in about even on time and cost.</>;
  }

  return (
    <>
      {parts}
      {"."}
      <FirstTokenNote first={verdict.firstToken} speed={verdict.speed} nameOf={nameOf} />
    </>
  );
}

/**
 * Only worth saying when the two measures disagree — a lane can lose on total
 * time while winning the wait that users actually notice.
 */
function FirstTokenNote({
  first,
  speed,
  nameOf,
}: {
  first: Comparison | null;
  speed: Comparison | null;
  nameOf: (id: LaneId) => string;
}) {
  if (!first?.winner || !speed?.winner) return null;
  if (first.winner === speed.winner) return null;
  return (
    <span className="block mt-3 font-sans text-[15px] leading-[1.5] text-ink-muted">
      Though {nameOf(first.winner)} started answering{" "}
      {formatFactor(first.factor)} sooner — which is the part a user feels.
    </span>
  );
}

function PickButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-[10px] px-4 py-2 border transition-colors ${
        active
          ? "bg-ink text-canvas border-ink"
          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
      }`}
    >
      {active ? "✓ " : ""}
      {children}
    </button>
  );
}
