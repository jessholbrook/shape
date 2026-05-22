"use client";

import {
  TONE_DIMENSIONS,
  type ToneDimensionId,
  type ToneStop,
  type ToneValues,
} from "@/lib/tone";

export function ToneDialControls({
  values,
  onChange,
}: {
  values: ToneValues;
  onChange: (next: ToneValues) => void;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Tone dials
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              warmth: 0,
              verbosity: 0,
              energy: 0,
              directness: 0,
              concreteness: 0,
            })
          }
          className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Reset dials
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {TONE_DIMENSIONS.map((dim) => {
          const stop = values[dim.id];
          const currentLabel = dim.stops[stop + 2].label;
          return (
            <div key={dim.id} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink">
                    {dim.label}
                  </div>
                  <div className="font-mono text-[10px] text-ink-quiet mt-0.5">
                    {dim.blurb}
                  </div>
                </div>
                <span
                  className={`font-mono text-[10px] rounded-full px-2 py-0.5 ${
                    stop === 0
                      ? "bg-line/60 text-ink-muted"
                      : "bg-highlight-soft text-highlight-ink"
                  }`}
                >
                  {currentLabel}
                </span>
              </div>
              <DialTrack
                id={dim.id}
                value={stop}
                stops={dim.stops.map((s) => s.label)}
                onChange={(next) =>
                  onChange({ ...values, [dim.id]: next })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DialTrack({
  id,
  value,
  stops,
  onChange,
}: {
  id: ToneDimensionId;
  value: ToneStop;
  stops: string[];
  onChange: (next: ToneStop) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {stops.map((_, i) => {
        const stop = (i - 2) as ToneStop;
        const active = stop === value;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onChange(stop)}
            aria-label={`Set ${id} to ${stops[i]}`}
            aria-pressed={active}
            className={`flex-1 h-2 rounded-full transition-colors ${
              active
                ? "bg-ink"
                : stop === 0
                ? "bg-line hover:bg-ink-quiet/40"
                : "bg-line hover:bg-highlight/40"
            }`}
          />
        );
      })}
    </div>
  );
}
