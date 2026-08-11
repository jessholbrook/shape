"use client";

import {
  RISK_BLURB,
  RISK_LABEL,
  type Tool,
  type ToolRisk,
} from "@/lib/agency";
import { InfoTip } from "@/components/info-tip";

const RISKS: ToolRisk[] = ["safe", "costly", "destructive"];

/**
 * One tool the model can reach for.
 *
 * The description field is the point of the whole playground — it's the only
 * thing the model knows about what this function does, and it sits in the
 * prompt like any other instruction. Risk is separate because it's *your*
 * judgement about consequences, and the model never sees it: it's what the
 * report grades against, not something the model can read and comply with.
 */
export function ToolEditor({
  tool,
  onChange,
  onRemove,
  canRemove,
}: {
  tool: Tool;
  onChange: (next: Tool) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="bg-canvas border border-line rounded-[12px] p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={tool.name}
          onChange={(e) => onChange({ ...tool, name: e.target.value })}
          placeholder="tool_name"
          aria-label="Tool name"
          className="w-[150px] bg-surface border border-line rounded-[8px] px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
        />
        <span className="font-mono text-[12px] text-ink-quiet">(</span>
        <input
          type="text"
          value={tool.params}
          onChange={(e) => onChange({ ...tool, params: e.target.value })}
          placeholder="arg, arg"
          aria-label="Tool parameters"
          className="flex-1 min-w-[100px] bg-surface border border-line rounded-[8px] px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
        />
        <span className="font-mono text-[12px] text-ink-quiet">)</span>
        <select
          value={tool.risk}
          onChange={(e) =>
            onChange({ ...tool, risk: e.target.value as ToolRisk })
          }
          aria-label="Tool risk"
          className={`bg-surface border rounded-[8px] px-2 py-1.5 font-mono text-[11px] focus:outline-none ${
            tool.risk === "safe"
              ? "border-success/50 text-success"
              : tool.risk === "costly"
              ? "border-highlight/50 text-highlight-ink"
              : "border-danger/50 text-danger"
          }`}
        >
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {RISK_LABEL[r]}
            </option>
          ))}
        </select>
        <InfoTip>{RISK_BLURB[tool.risk]}</InfoTip>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove ${tool.name || "tool"}`}
          className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-[18px] leading-none text-ink-quiet hover:text-danger disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ×
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet inline-flex items-center gap-1.5">
          Description — this is the prompt
          <InfoTip>
            Everything the model knows about this tool. It reads this the way
            it reads any other instruction, which means the wording changes the
            behaviour. &ldquo;Cannot be undone&rdquo; is a design decision.
          </InfoTip>
        </span>
        <textarea
          value={tool.description}
          onChange={(e) => onChange({ ...tool, description: e.target.value })}
          rows={2}
          placeholder="What this does, and what it costs to be wrong…"
          aria-label="Tool description"
          className="w-full bg-surface border border-line rounded-[8px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
      </label>
    </div>
  );
}
