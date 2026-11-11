"use client";

import { useState } from "react";
import { newId } from "@/lib/spread";
import type { Condition, ExperimentRun, Measure } from "@/lib/experiment";
import { TABLE_CHECKS, TABLE_CHECK_IDS, type TableCheck, type TableSetup } from "@/lib/experiment-table";
import { MAX_ROUNDS, STANCE_LABEL, parseStance, type Protocol, type Seat, type Stance } from "@/lib/roundtable";
import { RoundtableTranscript } from "@/components/play/roundtable-transcript";
import { EYEBROW, INPUT, LINK_BUTTON, Label, PANEL, PanelHeader } from "./fields";
import { MAX_CONDITIONS } from "./setup";

/**
 * The Lab's panels for a Round Table experiment. The seats are fixed (they
 * come from the playground); the decision can be reworded; conditions change
 * only the protocol or who speaks first — the room, not the prompts.
 */

const PLANT_LABEL: Record<NonNullable<Seat["plant"]>, string> = { for: "Planted: for", against: "Planted: against" };

// --- The table ---------------------------------------------------------------------

export function TableSetupPanel({
  table,
  locked,
  onChange,
}: {
  table: TableSetup;
  locked: boolean;
  onChange: (next: TableSetup) => void;
}) {
  return (
    <section className={PANEL} aria-label="The table">
      <PanelHeader
        num="02"
        title="The table"
        hint="Who sits at the table and what they're deciding. The seats come from Round Table; to change who they are, edit them there and open the table as an experiment again."
      />
      <ol className="flex flex-col gap-2" data-testid="lab-table-seats">
        {table.seats.map((s, i) => (
          <li key={s.id} className="border border-line rounded-[12px] p-3 bg-canvas/40">
            <div className="flex flex-wrap items-center gap-2">
              <span className={EYEBROW}>{i + 1}</span>
              <span className="font-display text-[16px] text-ink">{s.name}</span>
              {s.plant && (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
                  {PLANT_LABEL[s.plant]}
                </span>
              )}
              <span className="ml-auto font-mono text-[11px] text-ink-quiet">{s.model}</span>
            </div>
            <p className="font-sans text-[13px] leading-[1.55] text-ink-muted mt-1.5">{s.role}</p>
          </li>
        ))}
      </ol>
      <div>
        <Label htmlFor="lab-table-proposal">The proposal</Label>
        <textarea
          id="lab-table-proposal"
          rows={2}
          value={table.task.proposal}
          disabled={locked}
          onChange={(e) => onChange({ ...table, task: { ...table.task, proposal: e.target.value } })}
          className={`${INPUT} resize-y`}
        />
      </div>
      <div>
        <Label htmlFor="lab-table-brief">Background</Label>
        <textarea
          id="lab-table-brief"
          rows={3}
          value={table.task.brief}
          disabled={locked}
          onChange={(e) => onChange({ ...table, task: { ...table.task, brief: e.target.value } })}
          className={`${INPUT} resize-y`}
        />
      </div>
      <div>
        <p className={`${EYEBROW} mb-2`}>Protocol every condition starts from</p>
        <ProtocolControls
          idPrefix="lab-base"
          protocol={table.protocol}
          seats={table.seats}
          locked={locked}
          onChange={(protocol) => onChange({ ...table, protocol })}
        />
      </div>
    </section>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  locked,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  locked: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-line p-0.5 bg-canvas">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={locked}
          onClick={() => onChange(o.value)}
          className={`font-mono text-[11px] uppercase tracking-[0.06em] rounded-[8px] px-3 py-1.5 transition-colors disabled:opacity-60 ${
            value === o.value ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ProtocolControls({
  idPrefix,
  protocol,
  seats,
  locked,
  onChange,
}: {
  idPrefix: string;
  protocol: Protocol;
  seats: Seat[];
  locked: boolean;
  onChange: (next: Protocol) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <div>
        <Label>First round</Label>
        <div>
          <Segmented
            label="First round"
            value={protocol.firstRound}
            locked={locked}
            options={[
              { value: "open", label: "Open" },
              { value: "blind", label: "Blind" },
            ]}
            onChange={(firstRound) => onChange({ ...protocol, firstRound })}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-rounds`}>Rounds</Label>
        <select
          id={`${idPrefix}-rounds`}
          value={protocol.rounds}
          disabled={locked}
          onChange={(e) => onChange({ ...protocol, rounds: Number(e.target.value) })}
          className={`${INPUT} w-auto`}
        >
          {Array.from({ length: MAX_ROUNDS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>Stop</Label>
        <div>
          <Segmented
            label="Stop"
            value={protocol.stopRule}
            locked={locked}
            options={[
              { value: "budget", label: "After rounds" },
              { value: "consensus", label: "At consensus" },
            ]}
            onChange={(stopRule) => onChange({ ...protocol, stopRule })}
          />
        </div>
      </div>
      <div>
        <Label>Side-notes</Label>
        <div>
          <Segmented
            label="Side-notes"
            value={protocol.whispers ? "on" : "off"}
            locked={locked}
            options={[
              { value: "off", label: "None" },
              { value: "on", label: "Whispers" },
            ]}
            onChange={(v) => onChange({ ...protocol, whispers: v === "on" })}
          />
        </div>
      </div>
      <p className="font-sans text-[12px] text-ink-quiet basis-full">
        {seats.map((s) => s.name).join(" → ")} speak in this order unless a condition changes who opens.
      </p>
    </div>
  );
}

// --- Conditions --------------------------------------------------------------------

/** What a condition changes, against the base protocol. */
function changeOf(c: Condition, base: Protocol, seats: Seat[]): string {
  const p = c.patch.protocol ?? {};
  const parts: string[] = [];
  if (p.firstRound && p.firstRound !== base.firstRound) parts.push(`${p.firstRound} first round`);
  if (p.rounds !== undefined && p.rounds !== base.rounds) parts.push(`${p.rounds} ${p.rounds === 1 ? "round" : "rounds"}`);
  if (p.stopRule && p.stopRule !== base.stopRule) parts.push(p.stopRule === "consensus" ? "stops at consensus" : "runs every round");
  if (p.whispers !== undefined && !!p.whispers !== !!base.whispers) parts.push(p.whispers ? "side-notes on" : "side-notes off");
  if (c.patch.firstSpeaker) parts.push(`${seats.find((s) => s.id === c.patch.firstSpeaker)?.name ?? c.patch.firstSpeaker} opens`);
  return parts.join(", ");
}

/** Keep only the protocol fields that differ from the base, so a condition says exactly what it changes. */
function diffProtocol(next: Protocol, base: Protocol): Partial<Protocol> | undefined {
  const out: Partial<Protocol> = {};
  if (next.firstRound !== base.firstRound) out.firstRound = next.firstRound;
  if (next.rounds !== base.rounds) out.rounds = next.rounds;
  if (next.stopRule !== base.stopRule) out.stopRule = next.stopRule;
  if (!!next.whispers !== !!base.whispers) out.whispers = !!next.whispers;
  return Object.keys(out).length ? out : undefined;
}

export function TableConditionsEditor({
  conditions,
  table,
  locked,
  onChange,
}: {
  conditions: Condition[];
  table: TableSetup;
  locked: boolean;
  onChange: (next: Condition[]) => void;
}) {
  const update = (id: string, next: Condition) => onChange(conditions.map((c) => (c.id === id ? next : c)));
  return (
    <section className={PANEL} aria-labelledby="lab-conditions">
      <PanelHeader
        num="03"
        title="Conditions"
        hint="The baseline runs the table with the protocol above. Every other condition changes the room — the first round, the rounds, when it stops, side-notes, or who opens — never the prompts."
        action={
          <button
            type="button"
            className={LINK_BUTTON}
            disabled={locked || conditions.length >= MAX_CONDITIONS}
            onClick={() =>
              onChange([...conditions, { id: newId("c"), label: `Condition ${String.fromCharCode(65 + conditions.length)}`, patch: {} }])
            }
          >
            + Add condition
          </button>
        }
      />
      <div className="flex flex-col gap-3">
        {conditions.map((c, i) => {
          const baseline = i === 0;
          const effective: Protocol = { ...table.protocol, ...(c.patch.protocol ?? {}) };
          const change = changeOf(c, table.protocol, table.seats);
          return (
            <div key={c.id} className="border border-line rounded-[12px] p-4 flex flex-col gap-3 bg-canvas/40" data-testid="lab-table-condition">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`${EYEBROW} shrink-0`}>{baseline ? "Baseline" : "Condition"}</span>
                <input
                  aria-label="Condition name"
                  value={c.label}
                  disabled={locked}
                  onChange={(e) => update(c.id, { ...c, label: e.target.value })}
                  className={`${INPUT} flex-1 min-w-[180px]`}
                />
                {!baseline && (
                  <button type="button" className={LINK_BUTTON} disabled={locked} onClick={() => onChange(conditions.filter((x) => x.id !== c.id))}>
                    Remove
                  </button>
                )}
              </div>
              {baseline ? (
                <p className="font-sans text-[13px] text-ink-muted">Uses the protocol above, unchanged.</p>
              ) : (
                <>
                  <ProtocolControls
                    idPrefix={`lab-${c.id}`}
                    protocol={effective}
                    seats={table.seats}
                    locked={locked}
                    onChange={(next) => {
                      const protocol = diffProtocol(next, table.protocol);
                      const { protocol: _old, ...rest } = c.patch;
                      void _old;
                      update(c.id, { ...c, patch: protocol ? { ...rest, protocol } : rest });
                    }}
                  />
                  <div>
                    <Label htmlFor={`lab-${c.id}-first`}>Who opens</Label>
                    <select
                      id={`lab-${c.id}-first`}
                      value={c.patch.firstSpeaker ?? ""}
                      disabled={locked}
                      onChange={(e) => {
                        const { firstSpeaker: _old, ...rest } = c.patch;
                        void _old;
                        update(c.id, { ...c, patch: e.target.value ? { ...rest, firstSpeaker: e.target.value } : rest });
                      }}
                      className={`${INPUT} w-auto`}
                    >
                      <option value="">Same order as the table ({table.seats[0]?.name})</option>
                      {table.seats.slice(1).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className={`font-sans text-[13px] ${change ? "text-ink" : "text-warning"}`}>
                    {change ? `Changes: ${change}.` : "Same as the baseline — change one thing about the room to test it."}
                  </p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- Measures ----------------------------------------------------------------------

/** Which checks make sense for this table: the planted check needs a plant, the side-note check needs side-notes somewhere. */
export function applicableChecks(table: TableSetup, conditions: Condition[]): TableCheck[] {
  const planted = table.seats.some((s) => s.plant);
  const whispers = !!table.protocol.whispers || conditions.some((c) => c.patch.protocol?.whispers);
  return TABLE_CHECK_IDS.filter((c) => (c !== "planted-held" || planted) && (c !== "no-move-after-note" || whispers));
}

export function TableMeasuresPicker({
  measures,
  table,
  conditions,
  locked,
  onChange,
}: {
  measures: Measure[];
  table: TableSetup;
  conditions: Condition[];
  locked: boolean;
  onChange: (next: Measure[]) => void;
}) {
  const on = new Set(measures.flatMap((m) => (m.kind === "table" ? [m.check] : [])));
  const others = measures.filter((m) => m.kind !== "table");
  const toggle = (check: TableCheck) => {
    const nextChecks = on.has(check) ? [...on].filter((c) => c !== check) : [...on, check];
    // Keep the catalog's order so the results read the same way every time.
    const ordered = TABLE_CHECK_IDS.filter((c) => nextChecks.includes(c));
    onChange([
      ...ordered.map((c) => measures.find((m) => m.kind === "table" && m.check === c) ?? { id: `m_${c}`, label: TABLE_CHECKS[c].label, kind: "table" as const, check: c }),
      ...others,
    ]);
  };
  return (
    <section className={PANEL} aria-label="Measures">
      <PanelHeader
        num="04"
        title="What to measure"
        hint="Each check reads every finished table, the same way Round Table's report does — from the STANCE line each turn ends with. No model is asked what happened. A check that doesn't apply to a table isn't counted, rather than counted as a miss."
      />
      <ul className="flex flex-col gap-2">
        {applicableChecks(table, conditions).map((c) => (
          <li key={c}>
            <label className="flex items-start gap-3 border border-line rounded-[12px] p-3 bg-canvas/40 cursor-pointer">
              <input type="checkbox" className="mt-1 accent-ink" checked={on.has(c)} disabled={locked} onChange={() => toggle(c)} />
              <span>
                <span className="font-sans text-[14px] text-ink">
                  {TABLE_CHECKS[c].label}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">{TABLE_CHECKS[c].binary ? "rate" : "number"}</span>
                </span>
                <span className="block font-sans text-[13px] leading-[1.5] text-ink-muted mt-0.5">{TABLE_CHECKS[c].describe}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {on.size === 0 && <p className="font-sans text-[13px] text-warning">Pick at least one check.</p>}
    </section>
  );
}

// --- One run --------------------------------------------------------------------------

const stanceWord = (s: Stance | null) => (s ? STANCE_LABEL[s].toLowerCase() : "—");

/** One table, in brief: each seat's position round by round, and the full transcript on request. */
export function TableRunDetail({ run, seats }: { run: ExperimentRun; seats: Seat[] }) {
  const [open, setOpen] = useState(false);
  const turns = run.turns ?? [];
  if (turns.length === 0) return null;
  const rounds = Math.max(...turns.map((t) => t.round));
  return (
    <div className="mt-2 flex flex-col gap-2">
      <ul className="flex flex-col gap-0.5" aria-label="Positions by round">
        {seats.map((s) => {
          const path = Array.from({ length: rounds }, (_, i) => {
            const t = turns.find((x) => x.seatId === s.id && x.round === i + 1 && x.status === "done");
            return t ? parseStance(t.text) : null;
          });
          const moved = path[0] !== null && path.some((p) => p !== null && p !== path[0]);
          return (
            <li key={s.id} className="font-mono text-[11px] text-ink-muted">
              <span className="text-ink">{s.name}</span>
              {s.plant && <span className="text-ink-quiet"> (planted {s.plant})</span>}: {path.map(stanceWord).join(" → ")}
              {moved && <span className="text-highlight-ink"> · moved</span>}
            </li>
          );
        })}
      </ul>
      <button type="button" className={`${LINK_BUTTON} self-start`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide" : "Show"} transcript
      </button>
      {open && <RoundtableTranscript turns={turns} seats={seats} />}
    </div>
  );
}
