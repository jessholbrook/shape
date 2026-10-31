import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { JoinCodeForm } from "@/components/classroom/forms";

export const metadata: Metadata = {
  title: "Join a class",
  description: "Type the code your teacher gave you.",
};

export default function ClassLandingPage() {
  return (
    <Shell>
      <section className="mx-auto max-w-[720px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Class</SectionNumber>
        <h1 className="font-display text-[44px] md:text-[56px] leading-[1.02] tracking-tight text-ink mt-6">Join a class.</h1>
        <p className="font-sans text-[15px] leading-[1.6] text-ink-muted mt-5 mb-8">Type the code your teacher gave you.</p>
        <JoinCodeForm />
      </section>
    </Shell>
  );
}
