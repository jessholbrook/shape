import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { getArtifactForMeta } from "@/lib/supabase/server-artifacts";
import { ArtifactView } from "./artifact-view";

const KIND_LABEL = {
  diff: "Diff Log",
  tone: "Behavior Spec",
  persona: "Persona Card",
  refusal: "Refusal Scorecard",
  evals: "Eval Scorecard",
  choreographer: "Conversation",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}): Promise<Metadata> {
  const { handle, slug } = await params;
  const artifact = await getArtifactForMeta(handle, slug);
  if (!artifact || artifact.visibility !== "public") {
    return {
      title: "Artifact — Shape",
      description: "A published artifact from a Shape playground.",
    };
  }
  const kindLabel = KIND_LABEL[artifact.kind] ?? "Artifact";
  const title = `${artifact.title} — ${kindLabel} by ${handle}`;
  const description =
    artifact.summary || `A ${kindLabel.toLowerCase()} published from Shape.`;
  return {
    title,
    description,
    openGraph: {
      title: artifact.title,
      description,
      type: "article",
      authors: [handle],
    },
    twitter: {
      card: "summary_large_image",
      title: artifact.title,
      description,
    },
  };
}

export default async function ArtifactPage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;
  return (
    <Shell>
      <section className="mx-auto max-w-[920px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ArtifactView handle={handle} slug={slug} />
      </section>
    </Shell>
  );
}
