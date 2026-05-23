import Link from "next/link";
import type { CurriculumModule } from "@/lib/curriculum";

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
  note?: string;
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
        Next module
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
