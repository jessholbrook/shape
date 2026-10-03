"use client";

import { useState } from "react";
import type { Experiment, Runner } from "@/lib/experiment";
import { shareUrl } from "@/lib/sharing";
import { addSharedLink, removeSharedLink, useSharedLinks, type SharedLink } from "@/lib/shared-links";
import { INPUT, LINK_BUTTON, PANEL, PanelHeader } from "./fields";

type Published = { slug: string; deleteToken: string };

/**
 * Publish the experiment on screen as a read-only snapshot at /e/<slug>.
 * The reader confirms nothing private is in it first: prompts and answers go
 * out as they are, to anyone holding the link.
 */
export function SharePanel({
  experiment: e,
  title,
  runner,
  blockedReason,
}: {
  experiment: Experiment;
  /** The title as the reader has named it (the save bar's, if set). */
  title: string;
  runner: Runner;
  /** Why publishing would misrepresent the results right now, if it would. */
  blockedReason: string | null;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<Published | null>(null);
  const links = useSharedLinks();
  const mine = links.filter((l) => l.experimentId === e.id);
  const hasResults = e.runs.some((r) => r.status === "done");

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ experiment: { ...e, title }, runner }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.slug) throw new Error(body?.error?.message ?? "Couldn't publish. Try again in a minute.");
      addSharedLink({ slug: body.slug, deleteToken: body.deleteToken, title, createdAt: Date.now(), experimentId: e.id });
      setLatest({ slug: body.slug, deleteToken: body.deleteToken });
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={PANEL} aria-label="Share" data-testid="share-panel">
      <PanelHeader
        num="07"
        title="Share it"
        hint={
          hasResults
            ? "Publish a read-only snapshot — the design, every answer, and the manifest — at a link you can send. Anyone who opens it can rerun it in one click."
            : "No results yet, but you can still share the design: a link others can open and run themselves."
        }
      />
      <dl className="flex flex-col gap-2">
        {[
          ["Who sees it", "Anyone with the link. It isn't listed or searchable."],
          ["What's in it", "Your prompts, conditions and items, every model answer, and the manifest. Never your keys."],
          ["Afterwards", "It can't be edited. You can delete it from this browser at any time."],
        ].map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet pt-[3px]">{k}</dt>
            <dd className="font-sans text-[13px] leading-[1.5] text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {blockedReason ? (
        <p className="font-sans text-[13px] text-warning" data-testid="share-blocked">
          {blockedReason}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="inline-flex items-start gap-2 font-sans text-[14px] text-ink">
            <input type="checkbox" checked={confirmed} onChange={(ev) => setConfirmed(ev.target.checked)} className="mt-1 accent-[var(--highlight)]" />
            Nothing in these prompts or answers is private or personal.
          </label>
          <div>
            <button
              type="button"
              onClick={publish}
              disabled={!confirmed || busy}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {busy ? "Publishing…" : hasResults ? "Publish a link" : "Publish the design"}
              <span className="text-highlight">→</span>
            </button>
          </div>
          {error && (
            <p role="alert" className="font-sans text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>
      )}

      {latest && <FreshLink slug={latest.slug} />}

      {mine.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mb-2">
            Shared from this browser ({mine.length})
          </p>
          <ul className="flex flex-col gap-2">
            {mine.map((l) => (
              <LinkRow key={l.slug} link={l} />
            ))}
          </ul>
          <p className="font-sans text-[12px] text-ink-quiet mt-2">
            The key to delete a link is kept only in this browser. Clear its storage and the link stays up.
          </p>
        </div>
      )}
    </section>
  );
}

function FreshLink({ slug }: { slug: string }) {
  const url = shareUrl(window.location.origin, slug);
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-col gap-2" data-testid="share-link">
      <p className="font-sans text-[14px] text-ink">Published. Anyone with this link can read it and rerun it:</p>
      <div className="flex flex-wrap items-center gap-3">
        <input readOnly value={url} aria-label="Shared link" onFocus={(ev) => ev.target.select()} className={`${INPUT} font-mono text-[13px] flex-1 min-w-[240px]`} />
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}
          className={LINK_BUTTON}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON}>
          Open ↗
        </a>
      </div>
    </div>
  );
}

function LinkRow({ link }: { link: SharedLink }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this link? Anyone who opens it afterwards will see that it's gone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${link.slug}`, { method: "DELETE", headers: { "x-delete-token": link.deleteToken } });
      // 404: already gone (or never existed) — either way, nothing left to delete.
      if (res.ok || res.status === 404) removeSharedLink(link.slug);
      else setError((await res.json().catch(() => null))?.error?.message ?? "Couldn't delete it right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <a href={`/e/${link.slug}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[12px] text-ink underline decoration-highlight underline-offset-4">
        /e/{link.slug}
      </a>
      <span className="font-sans text-[12px] text-ink-quiet">{new Date(link.createdAt).toLocaleString()}</span>
      <button type="button" onClick={remove} disabled={busy} className={LINK_BUTTON}>
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="font-sans text-[12px] text-danger">{error}</span>}
    </li>
  );
}
