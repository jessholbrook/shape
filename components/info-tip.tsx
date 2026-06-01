"use client";

import { useId, useState } from "react";

/**
 * Small inline help marker. Renders a vermillion-on-soft "?" pill that
 * surfaces a short tooltip on hover or focus. Mouseout / blur dismisses.
 * Click-to-pin is intentionally not supported — these are quick reminders,
 * not docs.
 */
export function InfoTip({
  label,
  children,
}: {
  /** Accessible label for the trigger. Defaults to "More info". */
  label?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={label ?? "More info"}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          // Avoid the click bubbling to a wrapping <label>, which would focus
          // (and on selects: open) the associated control.
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center justify-center w-[14px] h-[14px] rounded-full bg-line/60 text-ink-quiet hover:bg-highlight-soft hover:text-highlight-ink focus:bg-highlight-soft focus:text-highlight-ink focus:outline-none font-mono text-[9px] font-medium leading-none transition-colors"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          id={id}
          className="absolute left-0 top-full mt-2 z-50 w-[260px] bg-ink text-canvas rounded-[8px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] px-3 py-2 font-sans text-[12px] leading-[1.45]"
        >
          {children}
        </span>
      )}
    </span>
  );
}
