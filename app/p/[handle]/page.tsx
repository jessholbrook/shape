import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { ProfileView } from "./profile-view";

export const metadata: Metadata = {
  title: "Profile — Shape",
  description: "Public artifacts published from a Shape handle.",
};

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
