import Link from "next/link";
import { SectionNumber } from "@/components/section-number";
import type { CurriculumModule } from "@/lib/curriculum";

/**
 * The standard article meta header: ← Learn back link, module-number badge,
 * H1 (title + optional italic suffix), and the "X min read · pairs with …"
 * meta line. Handles modules whose entire H1 is italic (empty `title` +
 * `italic` set) and modules without a paired playground (no "pairs with"
 * suffix).
 */
export function ArticleHeader({ module: mod }: { module: CurriculumModule }) {
  return (
    <>
      <Link
        href="/learn"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        ← Learn
      </Link>

      <div className="mt-10">
        <SectionNumber label={mod.kicker}>{mod.num}</SectionNumber>
      </div>

      <h1 className="font-display text-[56px] md:text-[80px] leading-[0.98] tracking-tight text-ink mt-6">
        {mod.title}
        {mod.italic && (
          <>
            {mod.title && " "}
            <span className="italic">{mod.italic}</span>
          </>
        )}
        .
      </h1>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        {mod.readMinutes} min read
        {mod.playground && (
          <>
            {" · pairs with "}
            <Link
              href={mod.playground.href}
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              {mod.playground.label}
            </Link>
          </>
        )}
      </p>
    </>
  );
}

export function Lede({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-display text-[24px] md:text-[28px] leading-[1.4] text-ink mt-12 italic">
      {children}
    </p>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[28px] md:text-[34px] leading-[1.15] tracking-tight text-ink mt-16">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[17px] leading-[1.65] text-ink mt-6 max-w-prose">
      {children}
    </p>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-6 flex flex-col gap-3 max-w-prose">{children}</ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="font-sans text-[16px] leading-[1.6] text-ink pl-5 relative">
      <span className="absolute left-0 top-2 w-1.5 h-1.5 rounded-full bg-highlight" />
      {children}
    </li>
  );
}

export function ExampleBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  );
}

/**
 * One side of a two-card example. Prompt label and output label default to
 * "System prompt" and "Output"; pass overrides per article. Note section
 * (default label "Read") only renders when `note` is provided.
 *
 * `note` accepts a string or JSX so an article can wrap key phrases in
 * <NoteAccent> to direct attention.
 */
export function ExampleCard({
  label,
  promptLabel = "System prompt",
  prompt,
  outputLabel = "Output",
  output,
  noteLabel = "Read",
  note,
}: {
  label: string;
  promptLabel?: string;
  prompt: string;
  outputLabel?: string;
  output: string;
  noteLabel?: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-5 flex flex-col gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
        {label}
      </span>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          {promptLabel}
        </p>
        <p className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
      <div className="border-t border-line pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          {outputLabel}
        </p>
        <p className="font-sans text-[13px] leading-[1.55] text-ink italic">
          &ldquo;{output}&rdquo;
        </p>
      </div>
      {note && (
        <div className="border-t border-line pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
            {noteLabel}
          </p>
          <p className="font-sans text-[12px] leading-[1.55] text-ink-muted">
            {note}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Inline emphasis for the load-bearing phrase inside an ExampleCard `note`.
 * Uses the soft highlight chip treatment — direct attention without painting
 * a whole paragraph.
 */
export function NoteAccent({ children }: { children: React.ReactNode }) {
  return (
    <mark className="bg-highlight-soft text-highlight-ink rounded-sm px-1 py-0.5 font-medium not-italic">
      {children}
    </mark>
  );
}

/**
 * A fill-in-the-blank scaffold rendered as a copyable mono block. Pass the
 * skeleton as children (string with ___ blanks) and an optional bullet list
 * of the parts the user is being asked to articulate.
 */
export function Template({
  children,
  checklist,
}: {
  children: React.ReactNode;
  checklist?: string[];
}) {
  return (
    <div className="mt-8 bg-surface border border-line rounded-[14px] p-5 md:p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Template
      </p>
      <p className="mt-3 font-mono text-[13px] leading-[1.7] text-ink whitespace-pre-wrap">
        {children}
      </p>
      {checklist && checklist.length > 0 && (
        <>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            What you&apos;re defining
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {checklist.map((item, i) => (
              <li
                key={i}
                className="font-sans text-[14px] leading-[1.55] text-ink-muted pl-4 relative"
              >
                <span className="absolute left-0 top-2 w-1 h-1 rounded-full bg-ink-quiet" />
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * Mid-article "Try it in the playground" card. Pass the descriptive title as
 * children (JSX so it can include italics), the button label, and the href.
 */
export function TryItCTA({
  href,
  buttonLabel,
  children,
}: {
  href: string;
  buttonLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-10 bg-surface border border-line rounded-[16px] p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Try it in the playground
        </p>
        <h3 className="font-display text-[22px] leading-[1.15] text-ink mt-2">
          {children}
        </h3>
      </div>
      <Link
        href={href}
        className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-5 py-3 font-sans text-[14px] hover:bg-ink/90 transition-colors"
      >
        {buttonLabel}
        <span className="text-highlight">→</span>
      </Link>
    </div>
  );
}

/**
 * Bottom-of-article pointer to the next module. Renders nothing when there
 * is no next module (last in the curriculum). Soon modules show with a
 * "Soon" pill and link to /learn.
 */
export function NextModuleFooter({
  next,
}: {
  next: CurriculumModule | undefined;
}) {
  if (!next) return null;
  return (
    <div className="mt-20 pt-8 border-t border-line">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Next up
      </p>
      <Link
        href={next.href !== "#" ? next.href : "/learn"}
        className="mt-3 inline-flex items-baseline gap-3 group"
      >
        <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-quiet">
          {next.num}
        </span>
        <span className="font-display text-[24px] md:text-[28px] leading-[1.15] text-ink group-hover:text-highlight-ink transition-colors">
          {next.title}
          {next.italic && (
            <>
              {" "}
              <span className="italic">{next.italic}</span>
            </>
          )}
        </span>
        {next.status === "soon" && (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet bg-line/60 rounded-full px-2 py-0.5">
            Soon
          </span>
        )}
      </Link>
    </div>
  );
}
