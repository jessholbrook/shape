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

export function GalleryView() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const backend = getArtifactBackend();
      const all = await backend.list();
      if (cancelled) return;
      const publicOnly = all.filter((a) => a.visibility === "public");
      setStatus({ kind: "loaded", artifacts: publicOnly });
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
  }, []);

  return (
    <div className="mt-16 flex flex-col gap-12">
      {status.kind === "loading" ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Loading public artifacts…
        </p>
      ) : status.artifacts.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-4">
            {status.artifacts.length}{" "}
            {status.artifacts.length === 1 ? "artifact" : "artifacts"} ·
            newest first
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {status.artifacts.map((a) => (
              <GalleryCard key={a.id} artifact={a} />
            ))}
          </div>
        </div>
      )}

      <ComingSoon />
    </div>
  );
}

function GalleryCard({ artifact: a }: { artifact: Artifact }) {
  return (
    <Link
      href={`/p/${a.handle}/${a.slug}`}
      className="group bg-surface border border-line rounded-[16px] p-6 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex items-center justify-between">
        <KindPill kind={a.kind} />
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {formatDate(a.publishedAt)}
        </span>
      </div>
      <h2 className="font-display text-[28px] md:text-[32px] leading-[1.1] tracking-tight text-ink mt-5">
        {a.title}
      </h2>
      {a.summary && (
        <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">
          {a.summary}
        </p>
      )}
      <div className="mt-6 pt-4 border-t border-line flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        <span>
          by{" "}
          <Link
            href={`/p/${a.handle}`}
            className="text-ink hover:underline decoration-highlight underline-offset-4 decoration-2"
            onClick={(e) => e.stopPropagation()}
          >
            {a.handle}
          </Link>
        </span>
        <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
          Open →
        </span>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-8 md:p-12 hatched">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Nothing in this browser yet
      </p>
      <h2 className="font-display text-[28px] md:text-[34px] leading-[1.15] text-ink mt-3">
        The first public artifacts will land here.
      </h2>
      <p className="font-sans text-[14px] text-ink-muted mt-4 max-w-md">
        Save a draft in a playground or studio, then use the Notebook&apos;s
        Publish action. The gallery shows every public artifact across all
        handles.
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
          href="/build"
          className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Open a Studio
        </Link>
      </div>
    </div>
  );
}

function ComingSoon() {
  return (
    <div className="pt-8 border-t border-line">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-highlight-ink">
        Coming in v1.0
      </p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <PreviewCard
          title="Curated highlights"
          blurb="A hand-picked set of artifacts that show the craft well. Refreshes monthly."
        />
        <PreviewCard
          title="Failure museum"
          blurb="Refusals that misfired, evals that swung, prompts that broke under pressure. Pattern-recognition fuel."
        />
      </div>
    </div>
  );
}

function PreviewCard({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 hatched">
      <h3 className="font-display text-[22px] leading-[1.15] text-ink">
        {title}
      </h3>
      <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3">
        {blurb}
      </p>
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
