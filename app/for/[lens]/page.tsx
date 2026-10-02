import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { BridgeCard } from "@/components/home/bridge-card";
import { LENSES, LENS_IDS, isLensId } from "@/lib/lenses";
import { MODULES, moduleTitle } from "@/lib/curriculum";
import { PLAYGROUNDS } from "@/lib/playgrounds";
import { RememberLens } from "./remember-lens";

type Props = { params: Promise<{ lens: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return LENS_IDS.map((lens) => ({ lens }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lens } = await params;
  if (!isLensId(lens)) return {};
  return { title: `For ${LENSES[lens].name.toLowerCase()}`, description: LENSES[lens].tagline };
}

/** Resolve a path href to a display row from the lesson or playground registry. */
function pathItem(href: string): { kind: "Lesson" | "Playground"; title: string; blurb: string } | null {
  const mod = MODULES.find((m) => m.href === href);
  if (mod) return { kind: "Lesson", title: moduleTitle(mod), blurb: mod.blurb };
  const pg = PLAYGROUNDS.find((p) => p.href === href);
  if (pg) return { kind: "Playground", title: `${pg.title} ${pg.italic}`, blurb: pg.blurb };
  return null;
}

export default async function LensPage({ params }: Props) {
  const { lens: id } = await params;
  if (!isLensId(id)) notFound();
  const lens = LENSES[id];

  return (
    <Shell>
      <RememberLens lens={id} />
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-24 pb-12">
        <SectionNumber>For {lens.name}</SectionNumber>
        <h1 className="font-display text-[56px] sm:text-[72px] md:text-[96px] leading-[0.95] tracking-tight text-ink mt-8 max-w-5xl">
          Shape <span className="italic">model</span> behavior.
        </h1>
        <p className="font-sans text-[18px] md:text-[22px] leading-[1.5] text-ink-muted mt-8 max-w-2xl">
          {lens.hero.lede}
        </p>
        <div className="mt-8">
          <Link
            href={lens.path[0]}
            className="group inline-flex items-center gap-2 bg-ink text-canvas rounded-[12px] px-6 py-3 font-sans text-[15px] hover:gap-3 transition-all"
          >
            Start the path
            <span className="text-highlight transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-12">
        <h2 className="font-display text-[36px] md:text-[48px] leading-[1.05] tracking-tight text-ink max-w-3xl">
          {lens.bridgeHeading.before} <span className="italic">{lens.bridgeHeading.italic}</span>.
        </h2>
        <p className="font-sans text-[18px] leading-[1.55] text-ink-muted mt-5 max-w-2xl">
          {lens.bridgeIntro}
        </p>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          {lens.bridges.map((b) => (
            <BridgeCard key={b.href + b.kicker} {...b} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 md:px-12 py-12">
        <h2 className="font-display text-[36px] md:text-[48px] leading-[1.05] tracking-tight text-ink">
          A suggested <span className="italic">path</span>.
        </h2>
        <ol className="mt-8 grid gap-3 max-w-3xl">
          {lens.path.map((href, i) => {
            const item = pathItem(href);
            if (!item) return null;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex gap-5 bg-surface border border-line rounded-[16px] p-5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
                >
                  <span className="font-mono text-[12px] text-ink-quiet pt-1">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
                      {item.kind}
                    </span>
                    <span className="block font-display text-[22px] leading-[1.2] text-ink mt-1">
                      {item.title}
                    </span>
                    <span className="block font-sans text-[14px] leading-[1.55] text-ink-muted mt-1">
                      {item.blurb}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>
      <div className="h-20" />
    </Shell>
  );
}
