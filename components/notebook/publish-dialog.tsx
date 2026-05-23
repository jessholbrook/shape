"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Draft } from "@/lib/drafts";
import {
  getArtifactBackend,
  slugForTitle,
  summarizeDraft,
  type ArtifactVisibility,
} from "@/lib/artifacts";
import {
  getHandle,
  setHandle as persistHandle,
  validateHandle,
} from "@/lib/handle";

type Status =
  | { kind: "idle" }
  | { kind: "publishing" }
  | { kind: "error"; reason: string };

export function PublishDialog({
  draft,
  onClose,
}: {
  draft: Draft;
  onClose: () => void;
}) {
  const router = useRouter();
  const initialSlug = useMemo(
    () => slugForTitle(draft.title) || draft.kind,
    [draft],
  );
  const [handle, setHandle] = useState("");
  const [slug, setSlug] = useState(initialSlug);
  const [summary, setSummary] = useState(summarizeDraft(draft));
  const [visibility, setVisibility] = useState<ArtifactVisibility>("public");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    const existing = getHandle();
    if (existing) setHandle(existing);
  }, []);

  async function handlePublish() {
    const h = validateHandle(handle);
    if (!h.ok) {
      setStatus({ kind: "error", reason: h.reason });
      return;
    }
    const cleanedSlug = slugForTitle(slug);
    if (!cleanedSlug) {
      setStatus({
        kind: "error",
        reason: "Slug needs at least one letter or number.",
      });
      return;
    }
    setStatus({ kind: "publishing" });
    try {
      persistHandle(h.normalized);
      const backend = getArtifactBackend();
      const existing = await backend.get(h.normalized, cleanedSlug);
      const artifact = await backend.publish({
        handle: h.normalized,
        slug: cleanedSlug,
        title: draft.title || draft.kind,
        summary,
        visibility,
        draft,
      });
      const url = existing
        ? `/p/${artifact.handle}/${artifact.slug}?republished=1`
        : `/p/${artifact.handle}/${artifact.slug}`;
      router.push(url);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", reason });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas border border-line rounded-[16px] max-w-[520px] w-full p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            Publish artifact
          </p>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        <h2 className="font-display text-[28px] leading-[1.15] text-ink mt-2">
          {draft.title || "Untitled"}
        </h2>
        <p className="font-mono text-[11px] text-ink-quiet mt-1">
          Publishes to a shareable URL that anyone can open.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <Field label="Handle" hint="Lowercase letters, numbers, hyphens. 2–32 characters.">
            <input
              type="text"
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value);
                if (status.kind === "error") setStatus({ kind: "idle" });
              }}
              placeholder="your-handle"
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-surface border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
            />
          </Field>
          <Field label="Slug" hint={`Public URL: /p/${handle || "you"}/${slugForTitle(slug) || "slug"}`}>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                if (status.kind === "error") setStatus({ kind: "idle" });
              }}
              spellCheck={false}
              autoComplete="off"
              className="w-full bg-surface border border-line rounded-[10px] px-3 py-2 font-mono text-[13px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
            />
          </Field>
          <Field label="Summary" hint="One line. Shown on the public page and in shares.">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="w-full bg-surface border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              Visibility
            </legend>
            <div className="flex gap-2 mt-1">
              <VisibilityChip
                value="public"
                current={visibility}
                onSelect={setVisibility}
              />
              <VisibilityChip
                value="private"
                current={visibility}
                onSelect={setVisibility}
              />
            </div>
          </fieldset>
        </div>

        {status.kind === "error" && (
          <p className="mt-4 font-sans text-[13px] text-danger">
            {status.reason}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={status.kind === "publishing"}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={status.kind === "publishing"}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {status.kind === "publishing" ? "Publishing…" : "Publish"}
            <span className="text-highlight">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      {children}
      {hint && (
        <span className="font-mono text-[10px] text-ink-quiet">{hint}</span>
      )}
    </label>
  );
}

function VisibilityChip({
  value,
  current,
  onSelect,
}: {
  value: ArtifactVisibility;
  current: ArtifactVisibility;
  onSelect: (v: ArtifactVisibility) => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-full px-3 py-1 border transition-colors ${
        active
          ? "bg-ink text-canvas border-ink"
          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
      }`}
    >
      {value === "public" ? "Public" : "Private"}
    </button>
  );
}
