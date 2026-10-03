"use client";

import Link from "next/link";
import { useState } from "react";
import { saveDraft } from "@/lib/drafts";
import type { Experiment } from "@/lib/experiment";

/**
 * "Open as experiment" — carry this playground's setup into the lab, where
 * it runs many times with intervals. The experiment is saved to the notebook
 * and opened in a new tab, so the playground (and any unsaved output) stays
 * exactly as it is: the unsaved-work guard never blocks navigation, so a
 * same-tab jump would quietly cost the reader their runs.
 */
export function OpenAsExperiment({
  build,
  disabled,
  hint = "Run this setup many times, with confidence intervals and a record of exactly what ran.",
}: {
  build: () => Experiment;
  disabled?: boolean;
  hint?: string;
}) {
  const [opened, setOpened] = useState<{ href: string; blocked: boolean } | null>(null);

  function open() {
    const experiment = build();
    const draft = saveDraft({ kind: "experiment", title: experiment.title, experiment });
    const href = `/lab?draft=${draft.id}`;
    const tab = window.open(href, "_blank");
    setOpened({ href, blocked: !tab });
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-wrap items-center justify-between gap-4">
      <div className="max-w-xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">Lab</p>
        <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-1">
          {opened ? (
            <>
              Saved to your notebook{opened.blocked ? "." : " and opened in a new tab."}{" "}
              <Link href={opened.href} className="text-ink underline decoration-highlight underline-offset-4 decoration-2">
                {opened.blocked ? "Open it here" : "Open it here instead"}
              </Link>
            </>
          ) : (
            hint
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className="inline-flex items-center gap-2 border border-ink text-ink rounded-[10px] px-4 py-2 font-sans text-[14px] hover:bg-ink hover:text-canvas transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Open as experiment <span aria-hidden>↗</span>
      </button>
    </div>
  );
}
