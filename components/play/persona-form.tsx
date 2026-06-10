"use client";

import { PERSONA_FIELDS, type PersonaValues } from "@/lib/persona";

export function PersonaForm({
  values,
  onChange,
  onReset,
}: {
  values: PersonaValues;
  onChange: (next: PersonaValues) => void;
  onReset?: () => void;
}) {
  const anyFilled = Object.values(values).some((v) => v.trim().length > 0);
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Persona
        </div>
        {onReset && anyFilled && (
          <button
            type="button"
            onClick={onReset}
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        {PERSONA_FIELDS.map((field) => (
          <Field
            key={field.id}
            label={field.label}
            hint={field.hint}
            required={field.required}
          >
            {field.rows === 1 ? (
              <input
                type="text"
                value={values[field.id]}
                onChange={(e) =>
                  onChange({ ...values, [field.id]: e.target.value })
                }
                placeholder={field.placeholder}
                className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
              />
            ) : (
              <textarea
                value={values[field.id]}
                onChange={(e) =>
                  onChange({ ...values, [field.id]: e.target.value })
                }
                rows={field.rows}
                placeholder={field.placeholder}
                className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
              />
            )}
          </Field>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint: string;
  required: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
          {label}
          {required && (
            <span className="ml-1 text-highlight-ink">*</span>
          )}
        </span>
      </div>
      <span className="font-mono text-[10px] text-ink-quiet leading-[1.5]">
        {hint}
      </span>
      {children}
    </label>
  );
}
