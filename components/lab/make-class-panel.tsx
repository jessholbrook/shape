"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Experiment } from "@/lib/experiment";
import { PANEL, PanelHeader } from "./fields";

type Me = { enabled: boolean; teacher: { email: string } | null };

/**
 * For signed-in teachers only: turn the experiment on screen into a class.
 * The class gets a locked copy of the design — later edits here don't change
 * what students run.
 */
export function MakeClassPanel({ experiment, title, blockedReason }: { experiment: Experiment; title: string; blockedReason: string | null }) {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ code: string; display: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/teach/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: Me | null) => live && setMe(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!me?.enabled || !me.teacher) return null;

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experiment, title }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.code) throw new Error(body?.error?.message ?? "Couldn't make the class.");
      setMade(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't make the class.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={PANEL} aria-label="Make a class" data-testid="make-class-panel">
      <PanelHeader
        num="Teach"
        title="Make a class"
        hint="Every student runs this exact experiment and the results pool together. The class gets a locked copy: editing it here afterwards won't change what students run."
      />
      {made ? (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3" data-testid="class-made">
          <p className="font-sans text-[14px] text-ink">
            Class made. Code: <span className="font-mono text-[18px] tracking-[0.12em]">{made.display}</span>
          </p>
          <Link href={`/teach/classes/${made.code}`} className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2">
            Open the class →
          </Link>
        </div>
      ) : blockedReason ? (
        <p className="font-sans text-[13px] text-warning">{blockedReason}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div>
            <button
              type="button"
              onClick={make}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 hover:bg-ink/90 transition-colors"
            >
              {busy ? "Making…" : `Make a class: “${title}”`} <span className="text-highlight">→</span>
            </button>
          </div>
          {error && (
            <p role="alert" className="font-sans text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
