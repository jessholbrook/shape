"use client";

import {
  AGENT_IDS,
  agentById,
  otherAgent,
  type AgentId,
  type RelayConfig,
} from "@/lib/agency";
import { InfoTip } from "@/components/info-tip";

/**
 * The room. Two agents, and the two things about the room you can change
 * without touching a prompt: who the user is attached to, and whether the
 * other agent can reach the user at all.
 *
 * The toggles below are the module's two experiments. The first is a
 * topology change — it moves the outcome without a single word of any prompt
 * changing, which is the point. The second is Module 10's lever at one
 * remove: whether an agent gets to read what its colleague's tools do.
 */
export function AgentPanel({
  relay,
  onChange,
  disabled,
}: {
  relay: RelayConfig;
  onChange: (next: RelayConfig) => void;
  disabled?: boolean;
}) {
  const entry = agentById(relay, relay.entryAgentId);
  const other = otherAgent(relay, relay.entryAgentId);

  function updateAgent(id: AgentId, patch: { name?: string; role?: string }) {
    onChange({
      ...relay,
      agents: relay.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
        Agents — the room
        <InfoTip>
          Two agents, one policy, the tools split between them. The user is
          attached to one of them. Everything the other one knows about the
          user arrived through a colleague.
        </InfoTip>
      </span>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {AGENT_IDS.map((id) => {
          const agent = agentById(relay, id);
          const isEntry = id === relay.entryAgentId;
          return (
            <div
              key={id}
              className="bg-canvas border border-line rounded-[12px] p-4 flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink">
                  {id.toUpperCase()}
                </span>
                <input
                  type="text"
                  value={agent.name}
                  disabled={disabled}
                  onChange={(e) => updateAgent(id, { name: e.target.value })}
                  placeholder="Agent name"
                  aria-label={`Agent ${id.toUpperCase()} name`}
                  className="flex-1 min-w-[120px] bg-surface border border-line rounded-[8px] px-3 py-1.5 font-mono text-[12px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none disabled:opacity-60"
                />
                <label className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted cursor-pointer">
                  <input
                    type="radio"
                    name="relay-entry-agent"
                    checked={isEntry}
                    disabled={disabled}
                    onChange={() => onChange({ ...relay, entryAgentId: id })}
                    className="accent-[var(--highlight)]"
                  />
                  Talks to the user
                </label>
              </div>
              <textarea
                value={agent.role}
                disabled={disabled}
                onChange={(e) => updateAgent(id, { role: e.target.value })}
                rows={2}
                placeholder="Who this agent is…"
                aria-label={`Agent ${id.toUpperCase()} role`}
                className="w-full bg-surface border border-line rounded-[8px] px-3 py-2 font-mono text-[12px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y disabled:opacity-60"
              />
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-4">
        <Toggle
          checked={relay.everyoneCanReachUser}
          disabled={disabled}
          onChange={(v) => onChange({ ...relay, everyoneCanReachUser: v })}
          label="Every agent can reach the user"
          tip={
            <>
              The topology experiment. Off: {other.name}&apos;s questions and
              answers go back through {entry.name}, who decides whether the
              user hears them. On: they go to the user directly. Nothing in
              any prompt changes.
            </>
          }
        />
        <Toggle
          checked={relay.showOtherDescriptions}
          disabled={disabled}
          onChange={(v) => onChange({ ...relay, showOtherDescriptions: v })}
          label="Agents see each other's tool descriptions"
          tip={
            <>
              The visibility experiment. Off: each agent knows its
              colleague&apos;s tools by name only, which is what a coordinator
              usually sees. On: it reads the full descriptions — a tool
              description is a prompt even for the agent that can&apos;t call
              the tool.
            </>
          }
        />
      </div>
    </div>
  );
}

function Toggle({
  checked,
  disabled,
  onChange,
  label,
  tip,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label: string;
  tip: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-2 font-mono text-[12px] text-ink cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--highlight)]"
      />
      {label}
      <InfoTip>{tip}</InfoTip>
    </label>
  );
}
