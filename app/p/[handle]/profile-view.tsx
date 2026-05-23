"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ARTIFACTS_EVENT,
  getArtifactBackend,
  type Artifact,
} from "@/lib/artifacts";

type Status =
  | { kind: "loading" }
  | { kind: "loaded"; artifacts: Artifact[] };

export function ProfileView({ handle }: { handle: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const backend = getArtifactBackend();
      const artifacts = await backend.listByHandle(handle);
      if (cancelled) return;
      setStatus({ kind: "loaded", artifacts });
    }
    load();
    const refresh = () => load();
    window.addEventListener(ARTIFACTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ARTIFACTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [handle]);

  if (status.kind === "loading") {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Loading…
      </p>
    );
  }

  const { artifacts } = status;
  const count = artifacts.length;

  return (
    <div className="flex flex-col gap-12">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Shape · public artifacts
        </p>
        <h1 className="font-display text-[64px] md:text-[88px] leading-[0.95] tracking-tight text-ink mt-4">
          {handle}
        </h1>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {count === 0
            ? "No public artifacts in this browser"
            : `${count} public ${count === 1 ? "artifact" : "artifacts"}`}
        </p>
      </header>

      {count === 0 ? (
        <EmptyState handle={handle} />
      ) : (
        <div className="flex flex-col gap-3">
          {artifacts.map((a) => (
            <ArtifactRow key={a.id} artifact={a} />
          ))}
        </div>
      )}

      <div className="pt-8 border-t border-line flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Public artifacts published from a Shape handle.
        </p>
        <Link
          href="/play"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
        >
          Try a playground →
        </Link>
      </div>
    </div>
  );
}

function ArtifactRow({ artifact: a }: { artifact: Artifact }) {
  return (
    <Link
      href={`/p/${a.handle}/${a.slug}`}
      className="group block bg-surface border border-line rounded-[14px] p-5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <KindPill kind={a.kind} />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {formatDate(a.publishedAt)}
            </span>
          </div>
          <h2 className="font-display text-[24px] md:text-[28px] leading-[1.15] text-ink mt-2">
            {a.title}
          </h2>
          {a.summary && (
            <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-2 max-w-2xl">
              {a.summary}
            </p>
          )}
        </div>
        <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors shrink-0">
          Open →
        </span>
      </div>
    </Link>
  );
}

function EmptyState({ handle }: { handle: string }) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-8 md:p-12 hatched">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Nothing public from{" "}
        <span className="text-ink-muted">{handle}</span> in this browser
      </p>
      <h2 className="font-display text-[28px] md:text-[34px] leading-[1.15] text-ink mt-3">
        Publish something to fill this page.
      </h2>
      <p className="font-sans text-[14px] text-ink-muted mt-4 max-w-md">
        Artifacts live in localStorage until the Supabase backend lands. Open
        a playground, save a draft, and use the Notebook&apos;s Publish action.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/play"
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] hover:bg-ink/90 transition-colors"
        >
          Browse playgrounds
          <span className="text-highlight">→</span>
        </Link>
        <Link
          href="/notebook"
          className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Open Notebook
        </Link>
      </div>
    </div>
  );
}

function KindPill({ kind }: { kind: Artifact["kind"] }) {
  const label =
    kind === "diff"
      ? "Diff Log"
      : kind === "tone"
      ? "Behavior Spec"
      : kind === "persona"
      ? "Persona Card"
      : kind === "refusal"
      ? "Refusal Scorecard"
      : kind === "evals"
      ? "Eval Scorecard"
      : kind === "case-study"
      ? "Case Study"
      : "Conversation";
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink bg-highlight-soft rounded-full px-2 py-0.5">
      {label}
    </span>
  );
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
