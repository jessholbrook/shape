"use client";

import { useState } from "react";
import { newId } from "@/lib/spread";
import {
  composeClassifier,
  composeRater,
  type Condition,
  type Item,
  type LabModel,
  type Measure,
} from "@/lib/experiment";
import { AssertionRow } from "@/components/play/assertion-row";
import { EYEBROW, INPUT, LINK_BUTTON, Label, MONO_INPUT, ModelRefSelect, PANEL, PanelHeader } from "./fields";

export const MAX_CONDITIONS = 4;
export const MAX_ITEMS = 6;
export const MAX_MEASURES = 5;

// --- Conditions ----------------------------------------------------------------

export function ConditionsEditor({
  conditions,
  onChange,
  locked,
}: {
  conditions: Condition[];
  onChange: (next: Condition[]) => void;
  locked: boolean;
}) {
  const update = (id: string, patch: Partial<Condition>) =>
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  return (
    <section className={PANEL} aria-labelledby="lab-conditions">
      <PanelHeader
        num="03"
        title="Conditions"
        hint="The baseline runs your setup as written. Every other condition changes one thing — that change is what the experiment tests."
        action={
          <button
            type="button"
            className={LINK_BUTTON}
            disabled={locked || conditions.length >= MAX_CONDITIONS}
            onClick={() =>
              onChange([
                ...conditions,
                { id: newId("c"), label: `Condition ${String.fromCharCode(65 + conditions.length)}`, patch: {} },
              ])
            }
          >
            + Add condition
          </button>
        }
      />
      <div className="flex flex-col gap-3">
        {conditions.map((c, i) => (
          <ConditionCard
            key={c.id}
            condition={c}
            baseline={i === 0}
            locked={locked}
            onChange={(patch) => update(c.id, patch)}
            onRemove={() => onChange(conditions.filter((x) => x.id !== c.id))}
          />
        ))}
      </div>
    </section>
  );
}

function ConditionCard({
  condition,
  baseline,
  locked,
  onChange,
  onRemove,
}: {
  condition: Condition;
  baseline: boolean;
  locked: boolean;
  onChange: (patch: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const p = condition.patch;
  const setPatch = (next: Condition["patch"]) => onChange({ patch: next });
  return (
    <div className="border border-line rounded-[12px] p-4 flex flex-col gap-3 bg-canvas/40">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`${EYEBROW} shrink-0`}>{baseline ? "Baseline" : "Condition"}</span>
        <input
          aria-label="Condition name"
          value={condition.label}
          disabled={locked}
          onChange={(e) => onChange({ label: e.target.value })}
          className={`${INPUT} flex-1 min-w-[180px]`}
        />
        {!baseline && (
          <button type="button" className={LINK_BUTTON} disabled={locked} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      {baseline ? (
        <p className="font-sans text-[13px] text-ink-muted">Uses the setup above, unchanged.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <Override
            label="Different system prompt"
            value={p.system}
            locked={locked}
            onChange={(system) => setPatch({ ...p, system })}
          />
          <Override
            label="Different user message"
            value={p.userTemplate}
            locked={locked}
            onChange={(userTemplate) => setPatch({ ...p, userTemplate })}
          />
        </div>
      )}
    </div>
  );
}

/** An optional override: collapsed reads "same as baseline"; open, it's an editor. */
function Override({
  label,
  value,
  locked,
  onChange,
}: {
  label: string;
  value: string | undefined;
  locked: boolean;
  onChange: (next: string | undefined) => void;
}) {
  if (value === undefined) {
    return (
      <p className="font-sans text-[13px] text-ink-muted flex flex-wrap items-center gap-2">
        {label}: <span className="text-ink-quiet">same as baseline</span>
        <button type="button" className={LINK_BUTTON} disabled={locked} onClick={() => onChange("")}>
          Change
        </button>
      </p>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <button type="button" className={LINK_BUTTON} disabled={locked} onClick={() => onChange(undefined)}>
          Use baseline
        </button>
      </div>
      <textarea
        aria-label={label}
        value={value}
        disabled={locked}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className={MONO_INPUT}
      />
    </div>
  );
}

// --- Items ---------------------------------------------------------------------

export function ItemsEditor({
  items,
  vars,
  onChange,
  locked,
}: {
  items: Item[];
  vars: string[];
  onChange: (next: Item[]) => void;
  locked: boolean;
}) {
  if (vars.length === 0) {
    return (
      <section className={PANEL} aria-label="Items">
        <PanelHeader
          num="04"
          title="Items"
          hint={
            <>
              Write <code className="font-mono text-[12px] text-ink">{"{{topic}}"}</code> in a message to test it
              across several inputs — one item per value. Without variables, each condition runs one message.
            </>
          }
        />
      </section>
    );
  }
  const update = (id: string, patch: Partial<Item>) => onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  return (
    <section className={PANEL} aria-label="Items">
      <PanelHeader
        num="04"
        title="Items"
        hint="Each item fills the variables in your messages. Results pool across items — more items, less chance one odd input drives the finding."
        action={
          <button
            type="button"
            className={LINK_BUTTON}
            disabled={locked || items.length >= MAX_ITEMS}
            onClick={() =>
              onChange([...items, { id: newId("i"), label: `Item ${items.length + 1}`, vars: Object.fromEntries(vars.map((v) => [v, ""])) }])
            }
          >
            + Add item
          </button>
        }
      />
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.id} className="flex flex-wrap items-center gap-2">
            {vars.map((v) => (
              <input
                key={v}
                aria-label={`${v} for ${it.label}`}
                placeholder={v}
                value={it.vars[v] ?? ""}
                disabled={locked}
                onChange={(e) => {
                  const nextVars = { ...it.vars, [v]: e.target.value };
                  update(it.id, { vars: nextVars, label: e.target.value || it.label });
                }}
                className={`${INPUT} flex-1 min-w-[160px]`}
              />
            ))}
            <button
              type="button"
              className={LINK_BUTTON}
              disabled={locked || items.length <= 1}
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {items.some((it) => vars.some((v) => !(it.vars[v] ?? "").trim())) && (
        <p className="font-sans text-[12px] text-warning">An item has an empty variable — its prompt will show the raw {"{{name}}"}.</p>
      )}
    </section>
  );
}

// --- Measures ------------------------------------------------------------------

type NewMeasureKind = "assertion" | "regex" | "length" | "classify" | "rate";

const KIND_LABEL: Record<NewMeasureKind, string> = {
  assertion: "Text check",
  regex: "Pattern (regex)",
  length: "Length in words",
  classify: "Model judgement — category",
  rate: "Model judgement — score",
};

function blankMeasure(kind: NewMeasureKind, judge: LabModel): Measure {
  const id = newId("m");
  switch (kind) {
    case "assertion":
      return { id, label: "contains a phrase", kind, assertion: { id: newId("a"), kind: "contains", value: "" } };
    case "regex":
      return { id, label: "matches a pattern", kind, pattern: "", flags: "i" };
    case "length":
      return { id, label: "length (words)", kind };
    case "classify":
      return {
        id,
        label: "judged yes",
        kind,
        question: "",
        labels: ["yes", "no"],
        target: "yes",
        judge,
      };
    case "rate":
      return { id, label: "judged score", kind, rubric: "", scale: 5, judge };
  }
}

export function MeasuresEditor({
  measures,
  onChange,
  locked,
  defaultJudge,
}: {
  measures: Measure[];
  onChange: (next: Measure[]) => void;
  locked: boolean;
  defaultJudge: LabModel;
}) {
  const [adding, setAdding] = useState<NewMeasureKind>("assertion");
  const update = (id: string, next: Measure) => onChange(measures.map((m) => (m.id === id ? next : m)));
  return (
    <section className={PANEL} aria-label="Measures">
      <PanelHeader
        num="05"
        title="Measures"
        hint="How each answer gets scored. Text checks are exact and free. Model judgements read meaning, but they're a model's opinion — the prompt it reads is shown so you can disagree with it."
      />
      <div className="flex flex-col gap-3">
        {measures.map((m) => (
          <MeasureCard
            key={m.id}
            measure={m}
            locked={locked}
            canRemove={measures.length > 1}
            onChange={(next) => update(m.id, next)}
            onRemove={() => onChange(measures.filter((x) => x.id !== m.id))}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Kind of measure to add"
          value={adding}
          disabled={locked || measures.length >= MAX_MEASURES}
          onChange={(e) => setAdding(e.target.value as NewMeasureKind)}
          className={`${INPUT} w-auto`}
        >
          {(Object.keys(KIND_LABEL) as NewMeasureKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={LINK_BUTTON}
          disabled={locked || measures.length >= MAX_MEASURES}
          onClick={() => onChange([...measures, blankMeasure(adding, defaultJudge)])}
        >
          + Add measure
        </button>
      </div>
    </section>
  );
}

function MeasureCard({
  measure: m,
  locked,
  canRemove,
  onChange,
  onRemove,
}: {
  measure: Measure;
  locked: boolean;
  canRemove: boolean;
  onChange: (next: Measure) => void;
  onRemove: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const kindLabel =
    m.kind === "assertion" ? KIND_LABEL.assertion : KIND_LABEL[m.kind as NewMeasureKind];
  return (
    <div className="border border-line rounded-[12px] p-4 flex flex-col gap-3 bg-canvas/40">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`${EYEBROW} shrink-0`}>{kindLabel}</span>
        <input
          aria-label="Measure name"
          value={m.label}
          disabled={locked}
          onChange={(e) => onChange({ ...m, label: e.target.value })}
          className={`${INPUT} flex-1 min-w-[180px]`}
        />
        <button type="button" className={LINK_BUTTON} disabled={locked || !canRemove} onClick={onRemove}>
          Remove
        </button>
      </div>

      {m.kind === "assertion" && (
        <AssertionRow
          assertion={m.assertion}
          canRemove={false}
          onRemove={() => {}}
          onChange={(assertion) => onChange({ ...m, assertion })}
        />
      )}

      {m.kind === "regex" && (
        <input
          aria-label="Pattern"
          placeholder="e.g. ^(yes|no)\b"
          value={m.pattern}
          disabled={locked}
          onChange={(e) => onChange({ ...m, pattern: e.target.value })}
          className={`${INPUT} font-mono text-[12px]`}
        />
      )}

      {m.kind === "length" && (
        <p className="font-sans text-[13px] text-ink-muted">Counts the words in each answer. Compared as an average.</p>
      )}

      {m.kind === "classify" && (
        <div className="flex flex-col gap-3">
          <div>
            <Label>Question the judge answers about each response</Label>
            <input
              aria-label="Judge question"
              value={m.question}
              disabled={locked}
              placeholder="e.g. Does the response agree with the user's stated view?"
              onChange={(e) => onChange({ ...m, question: e.target.value })}
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <Label>Labels (comma-separated)</Label>
              <input
                aria-label="Judge labels"
                value={m.labels.join(", ")}
                disabled={locked}
                onChange={(e) => {
                  const labels = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
                  onChange({ ...m, labels, target: labels.includes(m.target) ? m.target : labels[0] ?? "" });
                }}
                className={INPUT}
              />
            </div>
            <div>
              <Label>Counts as a hit</Label>
              <select
                aria-label="Target label"
                value={m.target}
                disabled={locked}
                onChange={(e) => onChange({ ...m, target: e.target.value })}
                className={INPUT}
              >
                {m.labels.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Judge model</Label>
              <ModelRefSelect ariaLabel="Judge model" value={m.judge} disabled={locked} onChange={(judge) => onChange({ ...m, judge })} />
            </div>
          </div>
        </div>
      )}

      {m.kind === "rate" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <Label>Rubric</Label>
            <input
              aria-label="Rubric"
              value={m.rubric}
              disabled={locked}
              placeholder="e.g. How confident does the response sound? 1 = very hedged, 5 = flatly certain."
              onChange={(e) => onChange({ ...m, rubric: e.target.value })}
              className={INPUT}
            />
          </div>
          <div>
            <Label>Scale</Label>
            <select
              aria-label="Scale"
              value={m.scale}
              disabled={locked}
              onChange={(e) => onChange({ ...m, scale: Number(e.target.value) as 5 | 7 })}
              className={INPUT}
            >
              <option value={5}>1 to 5</option>
              <option value={7}>1 to 7</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Judge model</Label>
            <ModelRefSelect ariaLabel="Judge model" value={m.judge} disabled={locked} onChange={(judge) => onChange({ ...m, judge })} />
          </div>
        </div>
      )}

      {(m.kind === "classify" || m.kind === "rate") && (
        <div>
          <button type="button" className={LINK_BUTTON} onClick={() => setShowPrompt((s) => !s)} aria-expanded={showPrompt}>
            {showPrompt ? "Hide" : "Show"} what the judge reads
          </button>
          {showPrompt && (
            <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-[1.6] text-ink-muted bg-canvas border border-line rounded-[10px] p-3">
              {(() => {
                const p = m.kind === "classify" ? composeClassifier(m, "…the model's answer…") : composeRater(m, "…the model's answer…");
                return `SYSTEM\n${p.system}\n\nUSER\n${p.user}`;
              })()}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
