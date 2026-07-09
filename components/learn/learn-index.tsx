"use client";

import Link from "next/link";
import { MODULES, type CurriculumModule } from "@/lib/curriculum";
import { useLearnProgress } from "@/lib/hooks/use-learn-progress";

/**
 * Client wrapper for the /learn index. Adds:
 * - a "Recommended next" card pointing at the first ready + unread module
 *   (excluding Module 0 setup)
 * - a "read X of Y" progress chip
 * - a ✓ badge on completed module rows
 *
 * Module 0 (setup) is included in the list but excluded from progress
 * accounting — it's a one-time onboarding step, not a reading module.
 */
export function LearnIndex() {
  const { read, hasRead, hydrated } = useLearnProgress();

  const readable = MODULES.filter(
    (m) => m.status === "ready" && m.slug !== "start",
  );
  const totalReady = MODULES.filter((m) => m.status === "ready").length;
  const readCount = readable.filter((m) => read.has(m.slug)).length;
  const upNext = readable.find((m) => !read.has(m.slug));
  const allRead = hydrated && readable.length > 0 && readCount === readable.length;

  return (
    <>
      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        {totalReady} of {MODULES.length} lessons live
        {hydrated && readable.length > 0 && (
          <>
            {" · "}
            <span className="text-ink-muted">
              {readCount} of {readable.length} read in this browser
            </span>
          </>
        )}
      </p>

      {/* Recommended next */}
      {hydrated && (upNext || allRead) && (
        <div className="mt-10">
          {upNext ? (
            <Link
              href={upNext.href}
              className="group block bg-surface border border-line rounded-[16px] p-6 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-highlight-ink">
                  Up next
                </span>
                <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
                  Open →
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-quiet">
                  {upNext.num}
                </span>
                <h2 className="font-display text-[30px] md:text-[36px] leading-[1.05] text-ink">
                  {upNext.title}
                  {upNext.italic && (
                    <>
                      {upNext.title && " "}
                      <span className="italic">{upNext.italic}</span>
                    </>
                  )}
                </h2>
              </div>
              <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-3 max-w-2xl">
                {upNext.blurb}
              </p>
            </Link>
          ) : (
            <div className="bg-surface border border-line rounded-[16px] p-6 md:p-7 hatched">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Curriculum complete
              </p>
              <h2 className="font-display text-[28px] md:text-[32px] leading-[1.1] text-ink mt-3">
                You&apos;ve read every live lesson.
              </h2>
              <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-3 max-w-2xl">
                More will show up here as they land. In the meantime, the
                playgrounds are where the design work happens.
              </p>
              <Link
                href="/play"
                className="mt-5 inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] hover:bg-ink/90 transition-colors"
              >
                Now make something
                <span className="text-highlight">→</span>
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 flex flex-col gap-3">
        {MODULES.map((m) => (
          <ModuleRow
            key={m.num}
            module={m}
            isRead={hasRead(m.slug)}
            hydrated={hydrated}
          />
        ))}
      </div>
    </>
  );
}

function ModuleRow({
  module: m,
  isRead,
  hydrated,
}: {
  module: CurriculumModule;
  isRead: boolean;
  hydrated: boolean;
}) {
  const ready = m.status === "ready";
  const inner = (
    <div
      className={`bg-surface border border-line rounded-[14px] p-5 md:p-6 transition-shadow ${
        ready
          ? "shadow-[0_1px_2px_rgba(0,0,0,0.04)] group-hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
          : "opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            {m.num}
          </span>
          <div className="min-w-0">
            {m.readMinutes && (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                {m.readMinutes} min read
              </span>
            )}
            <h2 className="font-display text-[26px] md:text-[30px] leading-[1.15] text-ink mt-1">
              {m.title}
              {m.italic && (
                <>
                  {m.title && " "}
                  <span className="italic">{m.italic}</span>
                </>
              )}
            </h2>
            <p className="font-sans text-[14px] leading-[1.55] text-ink-muted mt-2 max-w-2xl">
              {m.blurb}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hydrated && isRead && (
            <span
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5"
              title="You've read this in this browser"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Read
            </span>
          )}
          {!ready && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] rounded-full px-2 py-0.5 bg-line/60 text-ink-quiet">
              Soon
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-line flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {m.playground && (
          <span>
            Playground —{" "}
            <span className="text-ink-muted">{m.playground.label}</span>
          </span>
        )}
        {ready && (
          <span className="ml-auto font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
            Open →
          </span>
        )}
      </div>
    </div>
  );

  if (!ready) return inner;
  return (
    <Link href={m.href} className="group block">
      {inner}
    </Link>
  );
}
