/**
 * Expandable "why is temperature a knob at all?" explainer for Diff Mode.
 * Answers the sharper version of the temperature question — from someone who
 * already has the mechanism and wants to know why the parameter exists if
 * temp 0 is deterministic. Collapsed by default so it never nags.
 */
export function TemperatureNote() {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink inline-flex items-center gap-1.5">
        <span className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        Why is temperature a knob at all?
      </summary>
      <div className="mt-3 ml-4 pl-4 border-l-2 border-line flex flex-col gap-2 font-sans text-[13px] leading-[1.55] text-ink-muted max-w-xl">
        <p>
          Your mental model is right. The model produces a score for every
          possible next token; temperature reshapes those scores before one is
          sampled. Low temperature exaggerates the gaps so the top token
          dominates — near 0 it always takes the single most likely token, which
          is why it&apos;s deterministic. At 1 you get the model&apos;s raw
          distribution, untouched. Above 1 it flattens things out, giving
          unlikely tokens a real chance.
        </p>
        <p>
          So why keep the knob if 0 is repeatable?{" "}
          <strong className="text-ink">
            Because deterministic is only sometimes what you want.
          </strong>{" "}
          The parameter exists so you can choose where to sit. Turn it down for
          anything that needs to be repeatable — tests, extraction, rubric
          scoring, a single canonical answer. Turn it up when variety is the
          point — brainstorming, first drafts, offering three options instead of
          one.
        </p>
        <p>
          Temperature isn&apos;t there to be turned up. It&apos;s there so the
          trade-off between <em>repeatable</em> and <em>varied</em> is yours to
          make, per task. That choice is the design decision — which is exactly
          what the two configs above let you feel.
        </p>
      </div>
    </details>
  );
}
