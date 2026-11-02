"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL, modelKey, modelLabel, type ClassRunRow } from "@/lib/class-results";
import { formatDay } from "@/lib/classroom";
import type { Publication } from "@/lib/server/class-results";
import { LINK_BUTTON, PANEL, PanelHeader } from "@/components/lab/fields";
import { CopyLink } from "./forms";

const PRIMARY =
  "inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors";

/**
 * The teacher publishes the class's results — for the model they're looking
 * at — as an unlisted page. What goes out is decided on the server: runs
 * recorded by Shape only, no nicknames. This panel says so before anything
 * is published, and lists what's already out with a way to take it down.
 */
export function PublishPanel({
  code,
  rows,
  model,
  sharing,
  publications,
}: {
  code: string;
  rows: ClassRunRow[];
  model: string;
  sharing: boolean;
  publications: Publication[];
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<string | null>(null);
  // Read after hydration: the server doesn't know the origin, and the first
  // client render has to match what it sent.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- window is only readable after hydration
    setOrigin(window.location.origin);
  }, []);

  const recorded = model === ALL ? [] : rows.filter((r) => r.recorded && modelKey(r) === model && (r.status === "done" || r.status === "error"));
  const students = new Set(recorded.map((r) => r.nickname ?? "")).size;
  const leftOut = model === ALL ? 0 : rows.filter((r) => !r.recorded && modelKey(r) === model).length;

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teach/classes/${code}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? "Couldn't publish. Try again.");
      setLatest(body.slug);
      setConfirmed(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function takeDown(slug: string) {
    if (!window.confirm("Take this published result down? The link will stop working for everyone.")) return;
    setError(null);
    const res = await fetch(`/api/teach/classes/${code}/publications/${slug}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error?.message ?? "Couldn't take it down. Try again.");
      return;
    }
    if (latest === slug) setLatest(null);
    router.refresh();
  }

  return (
    <section className={PANEL} aria-label="Publish results" data-testid="publish-panel">
      <PanelHeader num="Publish" title="Share the class's results" />
      {!sharing ? (
        <p className="font-sans text-[14px] text-ink-muted">Publishing needs sharing, which is switched off right now.</p>
      ) : model === ALL ? (
        <p className="font-sans text-[14px] text-ink-muted">Pick one model above to publish its results — a mix of models isn&apos;t one result.</p>
      ) : recorded.length === 0 ? (
        <p className="font-sans text-[14px] text-ink-muted">
          No runs on {modelLabel(model)} were recorded by Shape, so there&apos;s nothing to publish for it. Only runs answered through
          Shape&apos;s free tier can be published.
        </p>
      ) : (
        <>
          <p className="font-sans text-[14px] leading-[1.55] text-ink-muted">
            Publishes an unlisted page anyone with the link can read, check, and rerun:{" "}
            <span className="text-ink">
              {recorded.length} {recorded.length === 1 ? "run" : "runs"} from {students} {students === 1 ? "student" : "students"} on{" "}
              {modelLabel(model)}
            </span>
            , your design and hypothesis, every answer, and a manifest anyone can verify.
          </p>
          <ul className="font-sans text-[13px] leading-[1.55] text-ink-muted list-disc pl-5">
            <li>No nicknames — nobody can tell who ran what.</li>
            <li>
              Only runs recorded by Shape, so the page can say every answer was checked on the server
              {leftOut > 0 ? ` (${leftOut} reported ${leftOut === 1 ? "run is" : "runs are"} left out; they're in your CSV)` : ""}.
            </li>
            <li>It stays up after the class is deleted, until you take it down here.</li>
          </ul>
          <label className="flex items-start gap-2 font-sans text-[14px] text-ink">
            <input type="checkbox" className="mt-1" checked={confirmed} onChange={(ev) => setConfirmed(ev.target.checked)} />
            Nothing in these prompts or answers is private or personal.
          </label>
          <div>
            <button type="button" onClick={publish} disabled={!confirmed || busy} className={PRIMARY} data-testid="publish-button">
              {busy ? "Publishing…" : "Publish results"} <span className="text-highlight">→</span>
            </button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="font-sans text-[13px] text-danger">
          {error}
        </p>
      )}

      {publications.length > 0 && (
        <div className="border-t border-line pt-3 flex flex-col gap-2" data-testid="publications">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">Published</p>
          <ul className="flex flex-col gap-2">
            {publications.map((p) => {
              const url = `${origin}/e/${p.slug}`;
              return (
                <li key={p.slug} className="flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[14px]">
                  <a href={`/e/${p.slug}`} className="text-ink underline decoration-highlight underline-offset-4" target="_blank" rel="noreferrer">
                    {p.model ?? p.title}
                  </a>
                  <span className="font-mono text-[11px] text-ink-quiet">
                    {p.runs} runs · {formatDay(new Date(p.created_at))}
                    {latest === p.slug ? " · just published" : ""}
                  </span>
                  {origin && <CopyLink url={url} />}
                  <button type="button" className={LINK_BUTTON} onClick={() => takeDown(p.slug)}>
                    Take down
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
