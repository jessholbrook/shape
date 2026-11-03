import Link from "next/link";
import { LENS_IDS, LENSES } from "@/lib/lenses";
import { DoingPreview, ReadingPreview, RolePreview } from "./path-previews";

const CARD = "flex flex-col bg-surface border border-line rounded-[16px] p-6 md:p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
const TITLE = "font-display text-[26px] md:text-[28px] leading-[1.15] text-ink";
const BODY = "font-sans text-[15px] leading-[1.55] text-ink-muted mt-3";
const CTA = "mt-auto pt-6 font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2";

/**
 * The home page's three ways in: read the lessons, try the playgrounds, or
 * follow a guided path for your background.
 */
export function LearningPaths() {
  return (
    <div id="lenses" className="scroll-mt-24 grid grid-cols-1 md:grid-cols-3 gap-5" data-testid="learning-paths">
      <Link href="/learn" className={`${CARD} group hover:border-ink/40 transition-colors`}>
        <h2 className={TITLE}>
          Learn by <span className="italic">reading</span>
        </h2>
        <div className="mt-4">
          <ReadingPreview />
        </div>
        <p className={BODY}>Short lessons on how model behavior gets made, each paired with a playground to try it in.</p>
        <span className={CTA}>
          Start reading <span aria-hidden>→</span>
        </span>
      </Link>

      <Link href="/play" className={`${CARD} group hover:border-ink/40 transition-colors`}>
        <h2 className={TITLE}>
          Learn by <span className="italic">doing</span>
        </h2>
        <div className="mt-4">
          <DoingPreview />
        </div>
        <p className={BODY}>Playgrounds that change one thing at a time. Free in your browser, no key needed.</p>
        <span className={CTA}>
          Open a playground <span aria-hidden>→</span>
        </span>
      </Link>

      <div className={CARD}>
        <h2 className={TITLE}>
          Learn by <span className="italic">role</span>
        </h2>
        <div className="mt-4">
          <RolePreview />
        </div>
        <p className={BODY}>A guided path built around what you already do.</p>
        <ul className="mt-5 flex flex-col gap-2" aria-label="Guided paths">
          {LENS_IDS.map((id) => (
            <li key={id}>
              <Link
                href={`/for/${id}`}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-line px-3 py-2 font-sans text-[14px] text-ink hover:border-ink transition-colors"
              >
                {LENSES[id].name} <span aria-hidden className="text-highlight">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
