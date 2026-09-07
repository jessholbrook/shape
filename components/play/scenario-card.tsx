"use client";

import {
  EXPECTED_LABEL,
  OUTCOME_LABEL,
  RISK_LABEL,
  gradeDecision,
  gradeRepair,
  toolUsed,
  type Expected,
  type Scenario,
  type ScenarioRow,
  type ScenarioRun,
  type Tool,
} from "@/lib/agency";
import { RepairPill } from "./repair-report";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";

const EXPECTATIONS: Expected[] = ["act", "ask", "answer"];

/**
 * One request, what you decided should happen, and what the model did.
 *
 * The expectation is set *before* the run and edited here rather than in the
 * report, so the judgement stays a design decision rather than a reaction to
 * the output — the same reason a rubric gets written before the scoring.
 *
 * The results area is a slot: solo mode renders the replies, relay mode
 * renders the trace. The editing half is the same either way.
 */
export function ScenarioCard({
  scenario,
  tools,
  onChange,
  onRemove,
  canRemove,
  children,
}: {
  scenario: Scenario;
  tools: Tool[];
  onChange: (next: Scenario) => void;
  onRemove: () => void;
  canRemove: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={scenario.label}
          onChange={(e) => onChange({ ...scenario, label: e.target.value })}
          placeholder="Scenario name"
          aria-label="Scenario name"
          className="flex-1 min-w-[120px] bg-transparent border border-transparent hover:border-line focus:border-ink rounded-[8px] px-2 py-1 -ml-2 font-mono text-[11px] uppercase tracking-[0.08em] text-ink focus:outline-none"
        />
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${scenario.label || "scenario"}`}
          className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-full text-[16px] leading-none text-ink-quiet hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ×
        </button>
      </div>

      <textarea
        value={scenario.userMessage}
        onChange={(e) => onChange({ ...scenario, userMessage: e.target.value })}
        rows={2}
        placeholder="What the user says…"
        aria-label="User message"
        className="w-full bg-canvas border border-line rounded-[8px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Should
        </span>
        <select
          value={scenario.expected}
          onChange={(e) =>
            onChange({ ...scenario, expected: e.target.value as Expected })
          }
          aria-label="Expected behaviour"
          className="bg-canvas border border-line rounded-[8px] px-2 py-1.5 font-mono text-[11px] text-ink focus:border-ink focus:outline-none"
        >
          {EXPECTATIONS.map((e) => (
            <option key={e} value={e}>
              {EXPECTED_LABEL[e]}
            </option>
          ))}
        </select>
        {scenario.expected === "act" && (
          <select
            value={scenario.expectedToolId ?? ""}
            onChange={(e) =>
              onChange({
                ...scenario,
                expectedToolId: e.target.value || undefined,
              })
            }
            aria-label="Expected tool"
            className="bg-canvas border border-line rounded-[8px] px-2 py-1.5 font-mono text-[11px] text-ink focus:border-ink focus:outline-none"
          >
            <option value="">any tool</option>
            {tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {children}
    </div>
  );
}

/** Solo mode's results: one reply per run, graded. */
export function SoloRuns({ row, tools }: { row: ScenarioRow; tools: Tool[] }) {
  const { scenario } = row;
  if (row.runs.length === 0) return null;
  return (
    <div className="border-t border-line pt-3 flex flex-col gap-3">
          {row.runs.map((run, i) => {
            const decision =
              run.status === "done" ? row.decisions[i] : undefined;
            const used = decision ? toolUsed(decision, tools) : undefined;
            const outcome = decision
              ? gradeDecision(scenario, decision, tools)
              : undefined;
            return (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
                    {row.runs.length > 1 ? `Run ${i + 1}` : "Reply"}
                    {outcome && (
                      <>
                        {" · "}
                        <span
                          className={
                            outcome === "correct"
                              ? "text-success"
                              : outcome === "over-acted" ||
                                outcome === "unknown-tool"
                              ? "text-danger"
                              : "text-highlight-ink"
                          }
                        >
                          {OUTCOME_LABEL[outcome]}
                        </span>
                      </>
                    )}
                  </span>
                  {run.status === "done" && !!run.raw && (
                    <ShareActions
                      copyText={run.raw}
                      filenameStem={`tool-bench-${scenario.id}-${i + 1}`}
                      markdown={`# ${scenario.label}\n\n> ${scenario.userMessage}\n\n${run.raw}\n`}
                    />
                  )}
                </div>
                {run.turns?.length ? (
                  <NativeTurns run={run} />
                ) : (
                  <div className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[36px]">
                    {run.error ? (
                      <span className="text-danger">{run.error}</span>
                    ) : run.raw ? (
                      run.raw
                    ) : run.status === "running" ? (
                      <StreamingPlaceholder />
                    ) : (
                      <span className="text-ink-quiet italic">Waiting…</span>
                    )}
                  </div>
                )}
                {used && (
                  <span
                    className={`font-mono text-[9px] rounded-full px-2 py-0.5 border self-start ${
                      used.risk === "safe"
                        ? "border-success/40 text-success"
                        : used.risk === "costly"
                        ? "border-highlight/50 text-highlight-ink"
                        : "border-danger/40 text-danger"
                    }`}
                  >
                    called {used.name} · {RISK_LABEL[used.risk]}
                  </span>
                )}
              </div>
            );
      })}
    </div>
  );
}

/**
 * The native mechanism's run: each assistant turn, the calls it made, and
 * the stub result each call got back — then what the model did next. The
 * repair verdict for the run sits at the end, where the reader has just
 * seen the evidence for it.
 */
function NativeTurns({ run }: { run: ScenarioRun }) {
  const turns = run.turns ?? [];
  const repair = run.status === "done" ? gradeRepair(turns) : null;
  return (
    <div className="flex flex-col gap-2">
      {turns.map((turn, i) =>
        turn.kind === "assistant" ? (
          <div key={i} className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
              {i === 0 ? "Model" : "Model, after the result"}
            </span>
            {turn.text && (
              <p className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap break-words">
                {turn.text}
              </p>
            )}
            {turn.calls.map((c) => (
              <span
                key={c.id}
                className="font-mono text-[11px] text-ink self-start rounded-[6px] px-2 py-1 bg-canvas border border-line break-all"
              >
                → {c.name}({c.args})
              </span>
            ))}
            {turn.status === "running" && !turn.text && turn.calls.length === 0 && (
              <StreamingPlaceholder />
            )}
            {turn.error && (
              <span className="font-mono text-[12px] text-danger">{turn.error}</span>
            )}
          </div>
        ) : (
          <div key={i} className="flex flex-col gap-0.5 ml-4">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
              {turn.name} returned
            </span>
            <p
              className={`font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words ${
                turn.failure ? "text-danger" : "text-ink-muted"
              }`}
            >
              {turn.result}
            </p>
          </div>
        ),
      )}
      {run.error && !turns.length && (
        <span className="font-mono text-[12px] text-danger">{run.error}</span>
      )}
      {repair && repair.outcome !== "none" && (
        <div className="flex items-center gap-2 pt-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink-quiet">
            After the failure
          </span>
          <RepairPill outcome={repair.outcome} />
        </div>
      )}
    </div>
  );
}
