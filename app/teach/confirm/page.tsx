import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { ConfirmSignIn } from "@/components/classroom/forms";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <Shell>
      <section className="mx-auto max-w-[720px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Teach</SectionNumber>
        <h1 className="font-display text-[44px] md:text-[56px] leading-[1.02] tracking-tight text-ink mt-6">Sign in to Shape.</h1>
        <p className="font-sans text-[15px] leading-[1.6] text-ink-muted mt-5 mb-8">One click and you&apos;re in. The link works once.</p>
        <ConfirmSignIn token={typeof token === "string" ? token : ""} />
      </section>
    </Shell>
  );
}
