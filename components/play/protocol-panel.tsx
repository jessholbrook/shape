"use client";

import { InfoTip } from "@/components/info-tip";
import type { Protocol } from "@/lib/roundtable";

/**
 * The protocol — everything about how the table is run that isn't in
 * anyone's prompt. Rounds, whether the first round is blind, when it stops,
 * and the temperature every seat speaks at. These are the levers the module
 * is about; the role prompts are deliberately not here.
 */
export function ProtocolPanel({
  protocol,
  onChange,
  temperature,
  onTemperatureChange,
  maxRounds,
  calls,
  costUsd,
  disabled,
}: {
  protocol: Protocol;
  onChange: (next: Protocol) => void;
  temperature: number;
  onTemperatureChange: (next: number) => void;
  maxRounds: number;
  calls: number;
  costUsd: number;
  disabled?: boolean;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
        The protocol
        <InfoTip>
          How the table is run, as distinct from who is at it. A blind first
          round has everyone give a position before hearing anyone; stopping at
          consensus ends the table the moment a round agrees; whispers let a
          seat pass one private line per turn to one other seat, which only
          that seat sees. Change these and nothing in any prompt changes.
        </InfoTip>
      </span>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Field label="Rounds">
          <select
            value={Math.min(protocol.rounds, maxRounds)}
            disabled={disabled}
            onChange={(e) => onChange({ ...protocol, rounds: Number(e.target.value) })}
            aria-label="Rounds"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
          >
            {Array.from({ length: maxRounds }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First round">
          <Toggle
            options={[
              { value: "open", label: "Open" },
              { value: "blind", label: "Blind" },
            ]}
            value={protocol.firstRound}
            disabled={disabled}
            onChange={(v) => onChange({ ...protocol, firstRound: v })}
            name="First round"
          />
        </Field>
        <Field label="Stop">
          <Toggle
            options={[
              { value: "budget", label: "After rounds" },
              { value: "consensus", label: "At consensus" },
            ]}
            value={protocol.stopRule}
            disabled={disabled}
            onChange={(v) => onChange({ ...protocol, stopRule: v })}
            name="Stop rule"
          />
        </Field>
        <Field label="Side-channels">
          <Toggle
            options={[
              { value: "off", label: "None" },
              { value: "on", label: "Whispers" },
            ]}
            value={protocol.whispers ? "on" : "off"}
            disabled={disabled}
            onChange={(v) => onChange({ ...protocol, whispers: v === "on" })}
            name="Side-channels"
          />
        </Field>
        <Field label={`Temperature ${temperature.toFixed(1)}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            disabled={disabled}
            onChange={(e) => onTemperatureChange(Number(e.target.value))}
            aria-label="Temperature"
            className="w-full accent-ink"
          />
        </Field>
      </div>

      <p className="font-mono text-[10px] leading-[1.6] text-ink-quiet">
        Up to {calls} calls — every seat speaks once per round, one call at a
        time, each reading the table so far
        {protocol.stopRule === "consensus" ? "; stops early the moment a round agrees" : ""}
        {protocol.whispers ? "; you see every whisper, the seats see only their own" : ""}.
        {costUsd > 0 ? ` About $${costUsd < 0.01 ? costUsd.toFixed(4) : costUsd.toFixed(3)} at list prices.` : ""}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">{label}</span>
      {children}
    </label>
  );
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
  disabled,
  name,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  name: string;
}) {
  return (
    <div role="group" aria-label={name} className="inline-flex rounded-[10px] border border-line bg-canvas p-0.5 w-full">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          disabled={disabled}
          aria-pressed={o.value === value}
          className={`flex-1 font-mono text-[11px] uppercase tracking-[0.06em] rounded-[8px] px-2 py-1.5 transition-colors disabled:cursor-not-allowed ${
            o.value === value ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink disabled:opacity-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
