import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { getHandleArtifactsForMeta } from "@/lib/supabase/server-artifacts";
import { ProfileView } from "./profile-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const artifacts = await getHandleArtifactsForMeta(handle);
  const count = artifacts.length;
  const description =
    count === 0
      ? `Public artifacts published from @${handle} on Shape.`
      : `${count} public ${count === 1 ? "artifact" : "artifacts"} published from @${handle} on Shape.`;
  return {
    title: `@${handle} — Shape`,
    description,
    openGraph: {
      title: `@${handle}`,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `@${handle}`,
      description,
    },
  };
}

export default async function HandleProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return (
    <Shell>
      <section className="mx-auto max-w-[920px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <ProfileView handle={handle} />
      </section>
    </Shell>
  );
}
