"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDrafts } from "@/lib/hooks/use-drafts";
import {
  deleteDraft,
  draftEditorHref,
  duplicateDraft,
  exportDraftJson,
  restoreDraft,
  type Draft,
} from "@/lib/drafts";
import { downloadBlob, slugify } from "@/lib/download";
import { PROVIDERS } from "@/lib/providers";
import { TONE_DIMENSIONS } from "@/lib/tone";
import { evaluateMatch } from "@/lib/refusal";
import { aggregateScore, SCORE_MAX } from "@/lib/evals";
import { ImportPanel } from "@/components/notebook/import-panel";
import { KindPill } from "@/components/kind-pill";

const UNDO_WINDOW_MS = 6000;

type PendingDelete = {
  draft: Draft;
  expiresAt: number;
  timerId: ReturnType<typeof setTimeout>;
};

export function Notebook() {
  const { drafts, hydrated } = useDrafts();
  const router = useRouter();
  const [pending, setPending] = useState<PendingDelete[]>([]);
  const [importing, setImporting] = useState(false);
  const pendingRef = useRef(pending);

  // Keep the ref in sync with state so the unmount cleanup below can read the
  // latest pending entries without subscribing to them.
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => clearTimeout(p.timerId));
    };
  }, []);

  function handleDelete(draft: Draft) {
    deleteDraft(draft.id);
    const timerId = setTimeout(() => {
      setPending((prev) => prev.filter((p) => p.draft.id !== draft.id));
    }, UNDO_WINDOW_MS);
    setPending((prev) => [
      ...prev,
      { draft, expiresAt: Date.now() + UNDO_WINDOW_MS, timerId },
    ]);
  }

  function handleUndo(id: string) {
    setPending((prev) => {
      const entry = prev.find((p) => p.draft.id === id);
      if (entry) {
        clearTimeout(entry.timerId);
        restoreDraft(entry.draft);
      }
      return prev.filter((p) => p.draft.id !== id);
    });
  }

  function handleDuplicate(draft: Draft) {
    const copy = duplicateDraft(draft.id);
    if (!copy) return;
    router.push(draftEditorHref(copy));
  }

  function handleExport(draft: Draft) {
    const json = exportDraftJson(draft);
    const slug = slugify(draft.title, draft.kind);
    downloadBlob(`${slug}.shape.json`, "application/json", json);
  }

  if (!hydrated) {
    return (
      <div className="bg-surface border border-line rounded-[16px] p-8 min-h-[240px] hatched">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Reading your browser for drafts…
        </p>
      </div>
    );
  }

  const diffDrafts = drafts.filter((d) => d.kind === "diff");
  const toneDrafts = drafts.filter((d) => d.kind === "tone");
  const personaDrafts = drafts.filter((d) => d.kind === "persona");
  const refusalDrafts = drafts.filter((d) => d.kind === "refusal");
  const evalsDrafts = drafts.filter((d) => d.kind === "evals");
  const choreographerDrafts = drafts.filter(
    (d) => d.kind === "choreographer",
  );
  const noDrafts = drafts.length === 0;

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {noDrafts
            ? "Nothing here yet"
            : `${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"}`}
        </p>
        <button
          type="button"
          onClick={() => setImporting((v) => !v)}
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
        >
          {importing ? "Cancel import" : "+ Import draft"}
        </button>
      </div>

      {importing && (
        <div className="mb-6">
          <ImportPanel
            onClose={() => setImporting(false)}
            onImported={() => {}}
          />
        </div>
      )}

      {noDrafts ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-12">
          {diffDrafts.length > 0 && (
            <Section title="Diff sessions" count={diffDrafts.length}>
              {diffDrafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onDuplicate={() => handleDuplicate(d)}
                  onExport={() => handleExport(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </Section>
          )}

          {personaDrafts.length > 0 && (
            <Section title="Personas" count={personaDrafts.length}>
              {personaDrafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onDuplicate={() => handleDuplicate(d)}
                  onExport={() => handleExport(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </Section>
          )}

          {toneDrafts.length > 0 && (
            <Section title="Tone designs" count={toneDrafts.length}>
              {toneDrafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onDuplicate={() => handleDuplicate(d)}
                  onExport={() => handleExport(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </Section>
          )}

          {refusalDrafts.length > 0 && (
            <Section title="Refusal labs" count={refusalDrafts.length}>
              {refusalDrafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onDuplicate={() => handleDuplicate(d)}
                  onExport={() => handleExport(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </Section>
          )}

          {evalsDrafts.length > 0 && (
            <Section title="Evaluations" count={evalsDrafts.length}>
              {evalsDrafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onDuplicate={() => handleDuplicate(d)}
                  onExport={() => handleExport(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </Section>
          )}

          {choreographerDrafts.length > 0 && (
            <Section title="Conversations" count={choreographerDrafts.length}>
              {choreographerDrafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onDuplicate={() => handleDuplicate(d)}
                  onExport={() => handleExport(d)}
                  onDelete={() => handleDelete(d)}
                />
              ))}
            </Section>
          )}
        </div>
      )}

      <UndoToasts pending={pending} onUndo={handleUndo} />
    </>
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

function DraftRow({
  draft,
  onDuplicate,
  onExport,
  onDelete,
}: {
  draft: Draft;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const href = draftEditorHref(draft);

  return (
    <div className="group bg-surface border border-line rounded-[14px] p-5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <KindPill kind={draft.kind} variant="short" />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              {formatRelative(draft.updatedAt)}
            </span>
          </div>
          <h3 className="font-display text-[22px] leading-[1.2] text-ink truncate">
            {draft.title || "Untitled"}
          </h3>
          <DraftSummary draft={draft} />
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href={href}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Open →
          </Link>
          <button
            type="button"
            onClick={onDuplicate}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={onExport}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Export JSON
          </button>
          <Link
            href={`/print/draft?id=${draft.id}`}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Save as PDF
          </Link>
          <button
            type="button"
            onClick={onDelete}
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
    const noteCount = draft.turns.filter((t) => t.note?.trim()).length;
    const lastMessage = draft.turns[draft.turns.length - 1]?.userMessage ?? "";
    return (
      <p className="font-mono text-[12px] text-ink-muted mt-2">
        {aName} <span className="text-ink-quiet">vs</span> {bName} ·{" "}
        <span className="text-ink-muted">
          {turnCount} {turnCount === 1 ? "turn" : "turns"}
        </span>
        {noteCount > 0 && (
          <>
            {" · "}
            <span className="text-ink-muted">
              {noteCount} {noteCount === 1 ? "note" : "notes"}
            </span>
          </>
        )}
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

  if (draft.kind === "persona") {
    const modelName =
      PROVIDERS[draft.provider].models.find((m) => m.id === draft.model)
        ?.name ?? draft.model;
    const name = draft.persona.name.trim();
    const role = draft.persona.role.trim();
    return (
      <p className="font-mono text-[12px] text-ink-muted mt-2 break-words">
        {modelName}
        {(name || role) && (
          <>
            {" — "}
            {name && <span className="text-ink">{name}</span>}
            {name && role && <span className="text-ink-quiet">, </span>}
            {role && (
              <span className="italic">
                {role.length > 80 ? role.slice(0, 77) + "…" : role}
              </span>
            )}
          </>
        )}
      </p>
    );
  }

  if (draft.kind === "refusal") {
    const modelName =
      PROVIDERS[draft.provider].models.find((m) => m.id === draft.model)
        ?.name ?? draft.model;
    let matched = 0;
    let scored = 0;
    for (const probe of draft.probes) {
      const verdict = draft.results[probe.id]?.verdict;
      const m = evaluateMatch(probe.expected, verdict ?? null);
      if (m !== "pending") scored += 1;
      if (m === "match") matched += 1;
    }
    return (
      <p className="font-mono text-[12px] text-ink-muted mt-2 break-words">
        {modelName} ·{" "}
        <span className="text-ink-muted">
          {matched}/{draft.probes.length} match
        </span>
        {scored < draft.probes.length && (
          <>
            {" · "}
            <span className="text-ink-quiet">
              {draft.probes.length - scored} unscored
            </span>
          </>
        )}
      </p>
    );
  }

  if (draft.kind === "evals") {
    const modelName =
      PROVIDERS[draft.provider].models.find((m) => m.id === draft.model)
        ?.name ?? draft.model;
    const agg = aggregateScore(draft.rubric, draft.cases, draft.results);
    const max = draft.rubric.length * SCORE_MAX;
    return (
      <p className="font-mono text-[12px] text-ink-muted mt-2 break-words">
        {modelName} · {draft.cases.length} cases × {draft.rubric.length}{" "}
        criteria
        {agg.avg !== null ? (
          <>
            {" · "}
            <span className="text-ink-muted">
              avg <span className="text-ink">{agg.avg.toFixed(1)}</span>/{max}
            </span>
          </>
        ) : (
          <>
            {" · "}
            <span className="text-ink-quiet">unscored</span>
          </>
        )}
      </p>
    );
  }

  if (draft.kind === "choreographer") {
    const modelName =
      PROVIDERS[draft.provider].models.find((m) => m.id === draft.model)
        ?.name ?? draft.model;
    const completed = draft.turns.filter(
      (t) => t.assistant.status === "done",
    ).length;
    return (
      <p className="font-mono text-[12px] text-ink-muted mt-2 break-words">
        {modelName} ·{" "}
        <span className="text-ink-muted">
          {completed}/{draft.turns.length} turns run
        </span>
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

function UndoToasts({
  pending,
  onUndo,
}: {
  pending: PendingDelete[];
  onUndo: (id: string) => void;
}) {
  if (pending.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 max-w-[90vw]">
      {pending.map((p) => (
        <UndoToast
          key={p.draft.id}
          draft={p.draft}
          expiresAt={p.expiresAt}
          onUndo={() => onUndo(p.draft.id)}
        />
      ))}
    </div>
  );
}

function UndoToast({
  draft,
  expiresAt,
  onUndo,
}: {
  draft: Draft;
  expiresAt: number;
  onUndo: () => void;
}) {
  // The toast renders for UNDO_WINDOW_MS, so the initial `now` is just
  // (expiresAt - window). The interval refreshes it from there.
  const [now, setNow] = useState(expiresAt - UNDO_WINDOW_MS);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  return (
    <div className="bg-ink text-canvas rounded-[12px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] px-4 py-3 flex items-center gap-4">
      <span className="font-sans text-[14px] truncate">
        Deleted{" "}
        <span className="font-display italic">
          {draft.title || "Untitled"}
        </span>
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-canvas/60 shrink-0">
        {remaining}s
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-canvas underline decoration-highlight underline-offset-4 decoration-2 shrink-0"
      >
        Undo
      </button>
    </div>
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
        Every playground has a Save draft action at the bottom. Anything
        you save shows up here, ready to reopen or export.
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
      <div className="mt-4 flex items-center justify-center gap-4 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        <Link href="/play" className="hover:text-ink">
          All playgrounds →
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
