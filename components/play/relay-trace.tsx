"use client";

import { useState } from "react";
import {
  OUTCOME_LABEL,
  RISK_LABEL,
  agentById,
  type Outcome,
  type RelayConfig,
  type RelayScenarioRow,
} from "@/lib/agency";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";

/**
 * One scenario's relay, step by step: who spoke, what they decided, and —
 * behind a disclosure — exactly what each agent was shown. The framing is
 * worth a look: a colleague's message arrives labelled as a colleague's,
 * never as the user's, and the channel line says where each keyword goes
 * from where that agent sits.
 */
export function RelayTrace({
  row,
  config,
}: {
  row: RelayScenarioRow;
  config: RelayConfig;
}) {
  const [showIncoming, setShowIncoming] = useState(false);
  if (row.runs.length === 0) return null;

  return (
    <div className="border-t border-line pt-3 flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setShowIncoming((v) => !v)}
        className="self-start font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        {showIncoming ? "Hide" : "Show"} what each agent was shown
      </button>

      {row.runs.map((run, i) => {
        const grade = row.grades[i];
        const group = grade?.group ?? null;
        const markdown = [
          `# ${row.scenario.label}`,
          "",
          `> ${row.scenario.userMessage}`,
          "",
          ...(grade?.steps ?? []).flatMap((v) => [
            `**${agentById(config, v.step.agentId).name}** — ${v.summary}`,
            "",
            v.step.raw,
            "",
          ]),
        ].join("\n");

        return (
          <div key={i} className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
                {row.runs.length > 1 ? `Run ${i + 1}` : "Relay"}
                {group && (
                  <>
                    {" · group: "}
                    <span className={toneClass(group)}>
                      {OUTCOME_LABEL[group]}
                    </span>
                  </>
                )}
                {run.status === "running" && !group && " · running"}
              </span>
              {run.status === "done" && !!run.raw && (
                <ShareActions
                  copyText={(grade?.steps ?? [])
                    .map(
                      (v) =>
                        `${agentById(config, v.step.agentId).name}: ${v.step.raw}`,
                    )
                    .join("\n")}
                  filenameStem={`tool-bench-relay-${row.scenario.id}-${i + 1}`}
                  markdown={markdown}
                />
              )}
            </div>

            {run.error && !run.trace?.length && (
              <span className="font-mono text-[12px] text-danger">
                {run.error}
              </span>
            )}

            {(grade?.steps ?? []).map((view, j, all) => {
              const agent = agentById(config, view.step.agentId);
              const isEntry = agent.id === config.entryAgentId;
              const agentGrade = grade?.agents[agent.id];
              const isLastForAgent = !all
                .slice(j + 1)
                .some((v) => v.step.agentId === agent.id);
              return (
                <div
                  key={j}
                  className={`flex flex-col gap-1 rounded-[10px] border px-3 py-2 ${
                    isEntry
                      ? "border-line bg-canvas"
                      : "border-line/70 bg-surface ml-4"
                  }`}
                >
                  {showIncoming && view.step.incoming && (
                    <p className="font-mono text-[10px] leading-[1.5] text-ink-quiet whitespace-pre-wrap break-words border-b border-line/70 pb-1.5 mb-0.5">
                      {view.step.incoming}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink">
                      {agent.name}
                    </span>
                    <span className="font-mono text-[10px] text-ink-quiet">
                      {view.step.status === "done" ? view.summary : ""}
                    </span>
                    {view.answeredForUser && (
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 bg-highlight-soft text-highlight-ink">
                        the user never heard this
                      </span>
                    )}
                    {isLastForAgent && agentGrade && group && (
                      <span
                        className={`ml-auto font-mono text-[9px] uppercase tracking-[0.08em] ${toneClass(agentGrade.outcome)}`}
                      >
                        {agent.name}: {OUTCOME_LABEL[agentGrade.outcome]}
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[20px]">
                    {view.step.error ? (
                      <span className="text-danger">{view.step.error}</span>
                    ) : view.step.raw ? (
                      view.step.raw
                    ) : view.step.status === "running" ? (
                      <StreamingPlaceholder />
                    ) : (
                      <span className="text-ink-quiet italic">Waiting…</span>
                    )}
                  </div>
                  {view.decision.kind === "act" &&
                    view.step.status === "done" &&
                    grade?.groupTool &&
                    j === grade.steps.length - 1 && (
                      <span
                        className={`font-mono text-[9px] rounded-full px-2 py-0.5 border self-start ${riskClass(grade.groupTool.risk)}`}
                      >
                        called {grade.groupTool.name} ·{" "}
                        {RISK_LABEL[grade.groupTool.risk]}
                      </span>
                    )}
                </div>
              );
            })}

            {grade?.status.kind === "circled" && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink">
                Turn budget ran out. Nobody decided.
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function toneClass(outcome: Outcome): string {
  if (outcome === "correct") return "text-success";
  if (outcome === "over-acted" || outcome === "unknown-tool") return "text-danger";
  if (outcome === "handed-off") return "text-ink-quiet";
  return "text-highlight-ink";
}

function riskClass(risk: "safe" | "costly" | "destructive"): string {
  return risk === "safe"
    ? "border-success/40 text-success"
    : risk === "costly"
      ? "border-highlight/50 text-highlight-ink"
      : "border-danger/40 text-danger";
}
