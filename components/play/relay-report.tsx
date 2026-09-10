"use client";

import {
  AGENT_IDS,
  EXPECTED_LABEL,
  OUTCOME_BLURB,
  OUTCOME_LABEL,
  agentById,
  type Outcome,
  type RelayConfig,
  type RelayReport,
} from "@/lib/agency";

/**
 * The relay report leads with the gap between the columns, because the gap
 * is the module. Each agent is graded from where it sits; the group is
 * graded by what the user actually got. When those disagree, every agent's
 * log reads clean and the email still went out.
 *
 * When an agent did break its policy directly, the headline is the solo
 * headline for that agent — a single-agent failure is a Module 10 finding,
 * not a Module 12 one.
 */
export function RelayReportPanel({
  report,
  config,
}: {
  report: RelayReport;
  config: RelayConfig;
}) {
  if (report.scored === 0) return null;
  const entry = agentById(config, config.entryAgentId);

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Agency policy · relay
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {report.scored} scenario{report.scored === 1 ? "" : "s"}
        </span>
      </div>

      <h2 className="font-display text-[26px] md:text-[32px] leading-[1.12] text-ink">
        <Headline report={report} config={config} />
      </h2>

      {report.answeredForUser > 0 && (
        <p className="font-sans text-[14px] leading-[1.5] text-ink-muted -mt-2">
          In {report.answeredForUser} scenario
          {report.answeredForUser === 1 ? "" : "s"}, a question that was the
          user&apos;s to answer came back to {entry.name}, and it answered
          instead of asking. The user never heard about it.
        </p>
      )}
      {report.injected.scenarios > 0 && (
        <p className="font-sans text-[14px] leading-[1.5] text-ink-muted -mt-2">
          {injectionSummary(report, config)}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {report.rows.map((row) => {
          const worst = row.grades[row.worstRunIndex];
          return (
            <div
              key={row.scenario.id}
              className="flex flex-col gap-1.5 border-t border-line pt-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <div className="flex-1 min-w-[150px] flex flex-col gap-0.5">
                  <span className="font-mono text-[11px] text-ink">
                    {row.scenario.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet whitespace-nowrap">
                    wanted: {EXPECTED_LABEL[row.scenario.expected]}
                  </span>
                </div>
                <Column caption="Group">
                  {row.runsScored === 0 ? (
                    <QuietPill>Not run</QuietPill>
                  ) : (
                    <OutcomePill
                      outcome={row.group}
                      count={
                        row.runsScored > 1 && row.group !== "correct"
                          ? `${row.groupCount}/${row.runsScored}`
                          : undefined
                      }
                    />
                  )}
                </Column>
                {AGENT_IDS.map((id) => (
                  <Column key={id} caption={agentById(config, id).name}>
                    {row.runsScored === 0 || row.agents[id].outcome === null ? (
                      <QuietPill>—</QuietPill>
                    ) : (
                      <OutcomePill
                        outcome={row.agents[id].outcome!}
                        count={
                          row.runsScored > 1 &&
                          row.agents[id].outcome !== "correct"
                            ? `${row.agents[id].count}/${row.runsScored}`
                            : undefined
                        }
                      />
                    )}
                  </Column>
                ))}
              </div>
              {worst && worst.steps.length > 0 && (
                <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
                  {worst.steps.map((v) => v.summary).join(" · ")}
                  {worst.status.kind === "circled" && " · turn budget ran out"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-line pt-4 flex flex-col gap-2">
        {presentOutcomes(report).map((o) => (
          <p
            key={o}
            className="font-mono text-[10px] leading-[1.6] text-ink-quiet"
          >
            <span className="text-ink-muted">{OUTCOME_LABEL[o]}</span> —{" "}
            {OUTCOME_BLURB[o]}
          </p>
        ))}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
          <span className="text-ink-muted">Group vs. agent</span> — each
          agent is graded on its own last decision, against its own tools; an
          agent that asked someone before acting has, from where it sits,
          asked first. The group is graded on what reached the user, and only{" "}
          {config.everyoneCanReachUser ? "an agent with a user channel" : entry.name}{" "}
          can reach the user.
        </p>
        {report.injected.scenarios > 0 && (
          <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
            <span className="text-ink-muted">The document&apos;s instruction</span>{" "}
            — a scenario&apos;s retrieved document carries a tell, a phrase that
            appears in a decision only if the agent acted on the document
            rather than the user. A handoff, a call, or a question that
            carries it is marked in the trace.
          </p>
        )}
        <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet mt-1">
          Nothing was executed. Tools are described in the prompt and each
          decision is parsed from the reply — the handoffs are prompted the
          same way, so you can read exactly what each agent was told.
        </p>
      </div>
    </div>
  );
}

function Headline({
  report,
  config,
}: {
  report: RelayReport;
  config: RelayConfig;
}) {
  const n = report.scored;
  const noun = n === 1 ? "scenario" : "scenarios";

  if (report.injected.executed > 0) {
    return (
      <>
        The document told the agents what to do, and{" "}
        <span className="text-danger">they did it</span> — in{" "}
        {report.injected.executed} of {report.injected.scenarios}{" "}
        {report.injected.scenarios === 1 ? "scenario" : "scenarios"} with a
        retrieved document. The user never asked.
      </>
    );
  }

  if (report.gap) {
    return (
      <>
        Neither agent broke its policy. The group{" "}
        {report.overActedDestructive > 0 ? (
          <>
            took an <span className="text-danger">irreversible action</span>
          </>
        ) : (
          <span className="text-danger">acted</span>
        )}{" "}
        without asking, in {report.overActed} of {n} {noun}.
      </>
    );
  }

  const offender = AGENT_IDS.find((id) => report.agentOverActed[id] > 0);
  if (offender) {
    const name = agentById(config, offender).name;
    return (
      <>
        {name}{" "}
        {report.overActedDestructive > 0 ? (
          <>
            took an <span className="text-danger">irreversible action</span>{" "}
            without asking
          </>
        ) : (
          <>
            <span className="text-danger">acted without asking</span>
          </>
        )}{" "}
        in {report.agentOverActed[offender]} of {n} {noun}.
      </>
    );
  }
  if (report.overAsked > 0) {
    return (
      <>
        Nothing ran without permission — but the group stopped to ask{" "}
        <span className="text-highlight-ink">
          {report.overAsked} time{report.overAsked === 1 ? "" : "s"}
        </span>{" "}
        it didn&apos;t need to.
      </>
    );
  }
  if (report.circled > 0) {
    return (
      <>
        Nothing ran without permission — but they{" "}
        <span className="text-highlight-ink">went in circles</span> in{" "}
        {report.circled} of {n} {noun}.
      </>
    );
  }
  if (report.correct === n) {
    return (
      <>
        The group stayed inside your policy in{" "}
        <span className="text-success">every scenario</span>.
      </>
    );
  }
  return <>The group stayed inside your policy, but didn&apos;t always act.</>;
}

function presentOutcomes(report: RelayReport): Outcome[] {
  const order: Outcome[] = [
    "over-acted",
    "unknown-tool",
    "wrong-tool",
    "unparsed",
    "stalled",
    "circled",
    "over-asked",
    "handed-off",
    "correct",
  ];
  const present = new Set<Outcome>();
  for (const r of report.rows) {
    if (r.runsScored === 0) continue;
    present.add(r.group);
    for (const id of AGENT_IDS) {
      const o = r.agents[id].outcome;
      if (o) present.add(o);
    }
  }
  return order.filter((o) => present.has(o));
}

function Column({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-1 min-w-[96px]">
      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet truncate max-w-[140px]">
        {caption}
      </span>
      {children}
    </div>
  );
}

function QuietPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet rounded-full px-2 py-0.5 bg-line/60">
      {children}
    </span>
  );
}

function OutcomePill({
  outcome,
  count,
}: {
  outcome: Outcome;
  count?: string;
}) {
  const tone =
    outcome === "correct"
      ? "bg-success/15 text-success"
      : outcome === "over-acted" || outcome === "unknown-tool"
        ? "bg-danger/10 text-danger"
        : outcome === "over-asked" || outcome === "handed-off"
          ? "bg-line/60 text-ink-quiet"
          : "bg-highlight-soft text-highlight-ink";
  return (
    <span
      className={`font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 whitespace-nowrap ${tone}`}
    >
      {OUTCOME_LABEL[outcome]}
      {count && <span className="ml-1 normal-case tracking-normal tabular-nums opacity-80">{count}</span>}
    </span>
  );
}

/**
 * What became of the retrieved document's instruction, as one sentence per
 * fate. Built as a string rather than JSX text so no boundary can lose its
 * space — the whitespace hazard the smoke suite exists to catch.
 */
function injectionSummary(report: RelayReport, config: RelayConfig): string {
  const inj = report.injected;
  const parts: string[] = [];
  if (inj.executed > 0) {
    parts.push(
      `In ${inj.executed} ${inj.executed === 1 ? "scenario" : "scenarios"} with a retrieved document, the group did what the document said — the instruction crossed the hop inside a handoff and arrived as a colleague's request.`,
    );
  }
  if (inj.asked > 0) {
    parts.push(`In ${inj.asked}, the document's instruction reached the user as a question before anything ran.`);
  }
  if (inj.relayed > 0) {
    parts.push(`In ${inj.relayed}, it crossed the hop and went no further.`);
  }
  if (parts.length === 0) {
    parts.push("The retrieved document's instruction never left the document.");
  }
  parts.push(
    config.carryProvenance
      ? "Handoffs carried provenance."
      : "Handoffs carried no provenance — flip it and run again.",
  );
  return parts.join(" ");
}
