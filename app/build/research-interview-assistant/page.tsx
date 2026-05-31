import { Suspense } from "react";
import Link from "next/link";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { getStudio } from "@/lib/studio";
import { Studio } from "./studio";

const STUDIO_ID = "research-interview-assistant";

export const metadata = {
  title: "Research Interview Assistant",
  description:
    "End-to-end Studio. Frame the brief, design the assistant, test it, reflect — produce a Case Study artifact.",
};

export default function ResearchInterviewAssistantPage() {
  const studio = getStudio(STUDIO_ID)!;

  return (
    <Shell>
      <section className="mx-auto max-w-[1280px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <Link
          href="/build"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          ← Build
        </Link>

        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <SectionNumber label="Studio">{studio.num}</SectionNumber>
            <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-3">
              {studio.title}
              {studio.italic && (
                <>
                  {" "}
                  <span className="italic">{studio.italic}</span>
                </>
              )}
            </h1>
          </div>
          <p className="font-sans text-[14px] text-ink-muted max-w-md">
            {studio.blurb}
          </p>
        </div>

        <div className="mt-12">
          <Suspense
            fallback={
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Loading studio…
              </p>
            }
          >
            <Studio studio={studio} />
          </Suspense>
        </div>
      </section>
    </Shell>
  );
}
