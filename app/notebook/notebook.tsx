"use client";

import Link from "next/link";
import { useDrafts } from "@/lib/hooks/use-drafts";
import { deleteDraft, type Draft } from "@/lib/drafts";
import { PROVIDERS } from "@/lib/providers";
import { TONE_DIMENSIONS } from "@/lib/tone";

export function Notebook() {
  const { drafts, hydrated } = useDrafts();

  if (!hydrated) {
    return (
      <div className="bg-surface border border-line rounded-[16px] p-8 min-h-[240px] hatched">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Reading your browser for drafts…
        </p>
      </div>
    );
  }

  if (drafts.length === 0) {
    return <EmptyState />;
  }

  const diffDrafts = drafts.filter((d) => d.kind === "diff");
  const toneDrafts = drafts.filter((d) => d.kind === "tone");

  return (
    <div className="flex flex-col gap-12">
      {diffDrafts.length > 0 && (
        <Section title="Diff sessions" count={diffDrafts.length}>
          {diffDrafts.map((d) => (
            <DraftRow key={d.id} draft={d} />
          ))}
        </Section>
      )}

      {toneDrafts.length > 0 && (
        <Section title="Tone setups" count={toneDrafts.length}>
          {toneDrafts.map((d) => (
            <DraftRow key={d.id} draft={d} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="font-display text-[26px] leading-[1.15] text-ink">
          {title}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function DraftRow({ draft }: { draft: Draft }) {
  const href =
    draft.kind === "diff"
      ? `/play/diff?draft=${draft.id}`
      : `/play/tone?draft=${draft.id}`;

  return (
    <div className="group bg-surface border border-line rounded-[14px] p-5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink bg-highlight-soft rounded-full px-2 py-0.5">
              {draft.kind === "diff" ? "Diff" : "Tone"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {formatRelative(draft.updatedAt)}
            </span>
          </div>
          <h3 className="font-display text-[22px] leading-[1.2] text-ink truncate">
            {draft.title || "Untitled"}
          </h3>
          <DraftSummary draft={draft} />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href={href}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Open →
          </Link>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Delete "${draft.title || "Untitled"}"?`)) {
                deleteDraft(draft.id);
              }
            }}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DraftSummary({ draft }: { draft: Draft }) {
  if (draft.kind === "diff") {
    const aName =
      PROVIDERS[draft.configA.provider].models.find(
        (m) => m.id === draft.configA.model,
      )?.name ?? draft.configA.model;
    const bName =
      PROVIDERS[draft.configB.provider].models.find(
        (m) => m.id === draft.configB.model,
      )?.name ?? draft.configB.model;
    const turnCount = draft.turns.length;
    const lastMessage = draft.turns[draft.turns.length - 1]?.userMessage ?? "";
    return (
      <p className="font-mono text-[12px] text-ink-muted mt-2">
        {aName} <span className="text-ink-quiet">vs</span> {bName} ·{" "}
        <span className="text-ink-muted">
          {turnCount} {turnCount === 1 ? "turn" : "turns"}
        </span>
        {lastMessage && (
          <>
            {" — "}
            <span className="italic">
              &quot;
              {lastMessage.slice(0, 70)}
              {lastMessage.length > 70 ? "…" : ""}
              &quot;
            </span>
          </>
        )}
      </p>
    );
  }

  const activeDimensions = TONE_DIMENSIONS.filter(
    (d) => draft.tone[d.id] !== 0,
  )
    .map((d) => `${d.label}: ${d.stops[draft.tone[d.id] + 2].label}`)
    .join(" · ");

  const modelName =
    PROVIDERS[draft.provider].models.find((m) => m.id === draft.model)?.name ??
    draft.model;

  return (
    <p className="font-mono text-[12px] text-ink-muted mt-2 break-words">
      {modelName}
      {activeDimensions ? (
        <>
          {" — "}
          <span className="text-ink-muted">{activeDimensions}</span>
        </>
      ) : (
        <span className="text-ink-quiet"> — dials at neutral</span>
      )}
    </p>
  );
}

function EmptyState() {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-8 md:p-12 text-center hatched">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        No drafts yet
      </p>
      <h2 className="font-display text-[28px] md:text-[34px] leading-[1.15] text-ink mt-3">
        Save something from a playground.
      </h2>
      <p className="font-sans text-[14px] text-ink-muted mt-4 max-w-md mx-auto">
        Every playground has a Save draft action at the bottom. Anything you
        save shows up here, ready to reopen.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/play/diff"
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] hover:bg-ink/90 transition-colors"
        >
          Open Diff Mode
          <span className="text-highlight">→</span>
        </Link>
        <Link
          href="/play/tone"
          className="inline-flex items-center gap-2 border border-ink text-ink rounded-[10px] px-4 py-2 font-sans text-[14px] hover:bg-ink hover:text-canvas transition-colors"
        >
          Open Tone Dial
        </Link>
      </div>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
