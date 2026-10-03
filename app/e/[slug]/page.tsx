import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { SharedView } from "@/components/lab/shared-view";
import { readShareConfig } from "@/lib/sharing";
import { loadShared } from "@/lib/server/share-handler";
import { supabaseRpc } from "@/lib/server/supabase";

/**
 * A shared experiment at an unlisted link. Rendered on request from the
 * database; kept out of search engines, since "unlisted" is the promise the
 * publisher was given.
 */

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

// Metadata and the page both need the row; one database read per request.
const load = cache(async (slug: string) => {
  const config = readShareConfig(process.env);
  const rpc = config.enabled ? supabaseRpc(config.supabaseUrl, config.supabaseKey) : null;
  return loadShared({ config, rpc }, slug);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await load(slug);
  const title = result.status === "ok" ? result.shared.title : "Shared experiment";
  return {
    title,
    description: result.status === "ok" ? result.shared.experiment.question : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function SharedExperimentPage({ params }: Props) {
  const { slug } = await params;
  const result = await load(slug);
  if (result.status === "missing") notFound();

  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Shared experiment</SectionNumber>
        {result.status === "ok" ? (
          <>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6">{result.shared.title}</h1>
            <div className="mt-10">
              <SharedView shared={result.shared} />
            </div>
          </>
        ) : (
          <div className="mt-6 max-w-xl" data-testid="shared-unavailable">
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink">Can&apos;t load this right now.</h1>
            <p className="font-sans text-[16px] leading-[1.6] text-ink-muted mt-5">
              Shared experiments are stored on Shape&apos;s server, and it isn&apos;t answering at the moment. The link
              itself is fine — try again in a few minutes.
            </p>
            <Link href="/lab" className="inline-block mt-6 font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2">
              Open the lab →
            </Link>
          </div>
        )}
      </section>
    </Shell>
  );
}
