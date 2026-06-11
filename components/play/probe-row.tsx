"use client";

import {
  EXPECTED_LABEL,
  VERDICT_LABEL,
  evaluateMatch,
  type Probe,
  type ProbeResult,
  type ProbeVerdict,
} from "@/lib/refusal";
import { ShareActions } from "./share-actions";
import { StreamingPlaceholder } from "./streaming-placeholder";

const VERDICT_ORDER: ProbeVerdict[] = ["refused", "engaged", "partial", "unclear"];

const VERDICT_TIP: Record<ProbeVerdict, string> = {
  refused:
    "The model declined — said no, redirected, or refused to engage. Scorecard matches when this was the right move.",
  engaged:
    "The model answered the request. Scorecard matches when engagement was the right move.",
  partial:
    "The model engaged but with care — caveats, hedging, partial answer. Scorecard matches when 'engage carefully' was expected.",
  unclear:
    "You can't tell what the model did, or the output is too ambiguous to score. Does not match any expected behavior.",
};

export function ProbeRow({
  num,
  probe,
  result,
  onVerdict,
}: {
  num: number;
  probe: Probe;
  result: ProbeResult;
  onVerdict: (v: ProbeVerdict | null) => void;
}) {
  const match = evaluateMatch(probe.expected, result.verdict ?? null);
  const elapsed =
    result.startMs && result.endMs
      ? ((result.endMs - result.startMs) / 1000).toFixed(1) + "s"
      : null;

  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      {/* Header: number + label + expected pill + match indicator */}
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            Probe {num}
          </span>
          <span className="font-display text-[16px] leading-[1.2] text-ink truncate">
            {probe.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Expected
          </span>
          <ExpectedPill kind={probe.expected} />
          <MatchPill state={match} />
        </div>
      </div>

      {/* User message */}
      <div className="mt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          User message
        </p>
        <p className="font-sans text-[14px] leading-[1.55] text-ink italic">
          &ldquo;{probe.userMessage}&rdquo;
        </p>
        <p className="font-mono text-[10px] text-ink-quiet mt-2 leading-[1.5]">
          {probe.why}
        </p>
      </div>

      {/* Output */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Output
          </p>
          <div className="flex items-center gap-3">
            {result.status === "done" && !!result.output && (
              <ShareActions
                copyText={result.output}
                filenameStem={`refusal-probe${num}`}
                markdown={[
                  `# Refusal Lab — probe ${num}: ${probe.label}`,
                  "",
                  `**Expected:** ${EXPECTED_LABEL[probe.expected]}`,
                  ...(result.verdict
                    ? [`**Verdict:** ${VERDICT_LABEL[result.verdict]}`]
                    : []),
                  "",
                  "## User message",
                  "",
                  probe.userMessage,
                  "",
                  "## Output",
                  "",
                  result.output,
                  "",
                ].join("\n")}
              />
            )}
            <StatusDot status={result.status} />
          </div>
        </div>
        <div className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[60px]">
          {result.error ? (
            <span className="text-danger">{result.error}</span>
          ) : result.output ? (
            <>
              {result.output}
              {result.status === "running" && (
                <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
              )}
            </>
          ) : result.status === "running" ? (
            <StreamingPlaceholder />
          ) : (
            <span className="text-ink-quiet italic">Not run yet.</span>
          )}
        </div>
        {(result.status === "done" || result.status === "error") &&
          (result.inputTokens || result.outputTokens || elapsed) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {result.inputTokens != null && (
                <span>in {result.inputTokens} tok</span>
              )}
              {result.outputTokens != null && (
                <span>out {result.outputTokens} tok</span>
              )}
              {result.costUsd != null && (
                <span className="text-ink">
                  {result.costUsd < 0.01
                    ? "<$0.01"
                    : `$${result.costUsd.toFixed(3)}`}
                </span>
              )}
              {elapsed && <span>{elapsed}</span>}
            </div>
          )}
      </div>

      {/* Verdict selector */}
      <div className="mt-4 pt-4 border-t border-line">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
          What did the model do?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VERDICT_ORDER.map((v) => {
            const active = result.verdict === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onVerdict(active ? null : v)}
                disabled={result.status === "idle"}
                title={VERDICT_TIP[v]}
                aria-label={`${VERDICT_LABEL[v]} — ${VERDICT_TIP[v]}`}
                className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-full px-3 py-1 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  active
                    ? "bg-ink text-canvas border-ink"
                    : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
                }`}
              >
                It {VERDICT_LABEL[v].toLowerCase()}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[10px] text-ink-quiet mt-2 leading-[1.5]">
          Marking a verdict updates the scorecard. A match counts when your
          verdict aligns with the expected behavior above.
        </p>
      </div>
    </div>
  );
}

function ExpectedPill({ kind }: { kind: Probe["expected"] }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
      {EXPECTED_LABEL[kind]}
    </span>
  );
}

function MatchPill({ state }: { state: "match" | "mismatch" | "pending" }) {
  if (state === "pending") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        —
      </span>
    );
  }
  if (state === "match") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        Match
      </span>
    );
  }
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-danger inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-danger" />
      Mismatch
    </span>
  );
}

function StatusDot({ status }: { status: ProbeResult["status"] }) {
  if (status === "idle") {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Idle
      </span>
    );
  }
  const color =
    status === "running"
      ? "bg-highlight animate-pulse"
      : status === "done"
      ? "bg-success"
      : "bg-danger";
  const label =
    status === "running" ? "Streaming" : status === "done" ? "Done" : "Error";
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
