import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { ArtifactView } from "./artifact-view";

export const metadata: Metadata = {
  title: "Artifact — Shape",
  description: "A published artifact from a Shape playground.",
};

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
