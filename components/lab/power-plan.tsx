"use client";

import { useMemo, useState } from "react";
import type { Experiment } from "@/lib/experiment";
import { planFor, target, TARGET_POINTS } from "@/lib/planning";
import { EYEBROW, INPUT } from "./fields";

/**
 * Before running: what these runs can reliably detect, and what it would
 * take to detect a smaller change. Most single runs of the lab can only see
 * large effects; saying so up front beats a "no clear difference" that
 * reads like "no effect".
 */
export function PowerPlan({ experiment, n, maxRunsPerCell }: { experiment: Experiment; n: number; maxRunsPerCell: number }) {
  const [points, setPoints] = useState<number>(15);
  const plan = useMemo(() => planFor(experiment, n), [experiment, n]);
  const t = plan.hasRates ? target(plan, points, maxRunsPerCell) : null;
  if (plan.perVersion < 1 || (!plan.hasRates && !plan.hasNumeric)) return null;

  return (
    <div className="border-t border-line pt-4 flex flex-col gap-2" data-testid="power-plan">
      <p className={EYEBROW}>What these runs can detect</p>
      <p className="font-sans text-[14px] leading-[1.55] text-ink-muted">
        Each version gets <span className="text-ink">{plan.perVersion} answers</span> ({n} {n === 1 ? "run" : "runs"}
        {plan.items > 1 ? ` × ${plan.items} items` : ""}).{" "}
        {plan.hasRates &&
          (plan.detectablePoints === null ? (
            <>
              That isn&apos;t enough to reliably catch even a 50-point change in a yes/no measure — treat any result as a first
              look.
            </>
          ) : (
            <>
              That reliably catches a change of about <span className="text-ink">{plan.detectablePoints} points</span> in a
              yes/no measure; smaller real changes will often show up as &ldquo;no clear difference&rdquo;.
            </>
          ))}
        {plan.hasNumeric && plan.detectableD !== null && (
          <>
            {" "}
            In a numeric measure, a shift of about <span className="text-ink">{plan.detectableD.toFixed(1)} standard deviations</span>.
          </>
        )}
      </p>

      {t && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[14px] leading-[1.55] text-ink-muted">
          <label htmlFor="power-target">To reliably catch</label>
          {/* A flex item sizes to its content, so the full-width input style stays inline. */}
          <div>
            <select
              id="power-target"
              value={points}
              onChange={(ev) => setPoints(Number(ev.target.value))}
              className={`${INPUT} w-auto py-1`}
            >
              {TARGET_POINTS.map((p) => (
                <option key={p} value={p}>
                  {p} points
                </option>
              ))}
            </select>
          </div>
          <span data-testid="power-target-text">
            you&apos;d need about <span className="text-ink">{t.needed} answers per version</span>
            {t.needed <= plan.perVersion
              ? " — these runs already have that."
              : t.fits
                ? ` — set runs per cell to ${t.runsPerCell}.`
                : ` — ${t.runsPerCell} runs per cell, beyond the lab's ${maxRunsPerCell}. Run it as a class instead: about ${t.runsNeeded} students running this design pool that many.`}
          </span>
        </div>
      )}

      <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet">
        &ldquo;Reliably&rdquo; means an 80% chance that a real change of that size shows up as a clear difference. Yes/no
        numbers assume a 50% starting rate, the hardest case. Judges add noise of their own, so treat these as a floor.
      </p>
    </div>
  );
}
