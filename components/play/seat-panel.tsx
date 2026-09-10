"use client";

import { useMemo } from "react";
import { PROVIDER_LIST, PROVIDERS, type ProviderId } from "@/lib/providers";
import { MIN_SEATS, type Seat, type Stance } from "@/lib/roundtable";
import { composePersonaPrompt } from "@/lib/persona";
import { useDrafts } from "@/lib/hooks/use-drafts";
import { ModelSelect } from "./model-select";
import { InfoTip } from "@/components/info-tip";

/**
 * Who is at the table, in speaking order. Each seat is a role prompt, a
 * model, and optionally the stance it is planted to hold. The order is a
 * protocol lever — move a seat and you have changed who anchors the room —
 * so it is edited here with arrows rather than by retyping.
 */
export function SeatPanel({
  seats,
  onChange,
  keyFor,
  maxSeats,
  disabled,
}: {
  seats: Seat[];
  onChange: (next: Seat[]) => void;
  keyFor: (provider: ProviderId) => boolean;
  maxSeats: number;
  disabled?: boolean;
}) {
  const { drafts } = useDrafts();
  const personas = useMemo(
    () => drafts.filter((d) => d.kind === "persona"),
    [drafts],
  );

  const update = (id: string, patch: Partial<Seat>) =>
    onChange(seats.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (index: number, dir: -1 | 1) => {
    const next = [...seats];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };
  const remove = (id: string) => {
    if (seats.length <= MIN_SEATS) return;
    onChange(seats.filter((s) => s.id !== id));
  };
  const add = () => {
    if (seats.length >= maxSeats) return;
    const base = seats[seats.length - 1];
    onChange([
      ...seats,
      {
        id: `seat-${Date.now().toString(36)}`,
        name: `Seat ${seats.length + 1}`,
        role: "",
        provider: base?.provider ?? "anthropic",
        model: base?.model ?? PROVIDERS.anthropic.defaultModel,
      },
    ]);
  };

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet inline-flex items-center gap-1.5">
          The table — {seats.length} seats, in speaking order
          <InfoTip>
            Each seat is a role prompt, kept private to that seat. Everyone
            sees the same transcript. The order is who speaks first in every
            round — move the planted dissenter to the top and see whether the
            room changes. A Persona Card from the Notebook can take a seat.
          </InfoTip>
        </span>
        <button
          type="button"
          onClick={add}
          disabled={disabled || seats.length >= maxSeats}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2 disabled:opacity-40 disabled:no-underline"
        >
          + Add a seat
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {seats.map((seat, i) => {
          const connected = keyFor(seat.provider);
          return (
            <div
              key={seat.id}
              className="border border-line rounded-[12px] p-4 flex flex-col gap-3 bg-canvas/40"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink w-14 shrink-0">
                  {ordinal(i + 1)}
                </span>
                <input
                  value={seat.name}
                  disabled={disabled}
                  onChange={(e) => update(seat.id, { name: e.target.value })}
                  aria-label={`Seat ${i + 1} name`}
                  placeholder="Name"
                  className="w-36 bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
                />
                <select
                  value={seat.plant ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    update(seat.id, {
                      plant: e.target.value === "" ? undefined : (e.target.value as Exclude<Stance, "undecided">),
                    })
                  }
                  aria-label={`Seat ${i + 1} planted stance`}
                  className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
                >
                  <option value="">Not planted</option>
                  <option value="for">Planted: for</option>
                  <option value="against">Planted: against</option>
                </select>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={disabled || i === 0}
                    aria-label={`Move ${seat.name || `seat ${i + 1}`} earlier`}
                    className="w-7 h-7 rounded-full border border-line font-mono text-[12px] text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={disabled || i === seats.length - 1}
                    aria-label={`Move ${seat.name || `seat ${i + 1}`} later`}
                    className="w-7 h-7 rounded-full border border-line font-mono text-[12px] text-ink-muted hover:text-ink disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(seat.id)}
                    disabled={disabled || seats.length <= MIN_SEATS}
                    aria-label={`Remove ${seat.name || `seat ${i + 1}`}`}
                    className="ml-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger disabled:opacity-30"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <textarea
                value={seat.role}
                disabled={disabled}
                onChange={(e) => update(seat.id, { role: e.target.value })}
                rows={3}
                aria-label={`Seat ${i + 1} role`}
                placeholder="Who this seat is and what they are at the table to do."
                className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] leading-[1.6] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y disabled:opacity-60"
              />

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={seat.provider}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = e.target.value as ProviderId;
                    update(seat.id, { provider: next, model: PROVIDERS[next].defaultModel });
                  }}
                  aria-label={`Seat ${i + 1} provider`}
                  className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none disabled:opacity-60"
                >
                  {PROVIDER_LIST.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <ModelSelect
                  provider={seat.provider}
                  model={seat.model}
                  onChange={(model) => update(seat.id, { model })}
                  ariaLabel={`Seat ${i + 1} model`}
                  className="flex-1 min-w-[180px] bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[12px] text-ink focus:border-ink focus:outline-none"
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1 w-16 shrink-0 ${
                    connected ? "text-success" : "text-danger"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success" : "bg-danger"}`} />
                  {connected ? "Key" : "No key"}
                </span>
                {personas.length > 0 && (
                  <select
                    value=""
                    disabled={disabled}
                    onChange={(e) => {
                      const d = personas.find((p) => p.id === e.target.value);
                      if (!d || d.kind !== "persona") return;
                      update(seat.id, {
                        name: d.persona.name.trim() || seat.name,
                        role: composePersonaPrompt(d.persona),
                      });
                    }}
                    aria-label={`Seat ${i + 1}: take a Persona Card`}
                    className="bg-canvas border border-line rounded-[10px] px-3 py-2 font-mono text-[11px] text-ink-muted focus:border-ink focus:outline-none disabled:opacity-60"
                  >
                    <option value="">Persona Card…</option>
                    {personas.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th"][n - 1] ?? `${n}th`;
}
