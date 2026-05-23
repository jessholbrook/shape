import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ProfileGate } from "./profile-gate";

export const metadata = {
  title: "Profile — Shape",
  description: "Your public Shape profile page.",
};

export default function ProfilePage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[820px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber label="Profile">07</SectionNumber>
        <ProfileGate />
      </section>
    </Shell>
  );
}
