import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { Design } from "@/components/lab/shared-view";
import { JoinForm } from "@/components/classroom/forms";
import { memberCookieName, normalizeJoinCode } from "@/lib/classroom";
import { currentMember, loadStudentClass } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class", robots: { index: false, follow: false } };

const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet";

export default async function StudentClassPage({ params }: { params: Promise<{ code: string }> }) {
  const raw = (await params).code;
  const code = normalizeJoinCode(raw);
  if (!code) notFound();
  const deps = classDeps();
  const result = await loadStudentClass(deps, code);
  if (result.status === "missing") notFound();
  const member =
    result.status === "ok" ? await currentMember(deps, code, (await cookies()).get(memberCookieName(code))?.value ?? null) : null;

  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Class</SectionNumber>
        {result.status === "unavailable" ? (
          <div className="mt-6 max-w-xl" data-testid="class-unavailable">
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink">Can&apos;t load this right now.</h1>
            <p className="font-sans text-[16px] leading-[1.6] text-ink-muted mt-5">
              Shape&apos;s server isn&apos;t answering at the moment. Your code is fine — try again in a few minutes.
            </p>
            <Link href="/class" className="inline-block mt-6 font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2">
              Enter a different code →
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6">{result.data.title}</h1>
            <div className="mt-10 flex flex-col gap-6">
              {member ? (
                <p className="font-sans text-[15px] text-ink-muted" data-testid="class-member">
                  You&apos;re in as <span className="text-ink">{member.nickname}</span>.
                </p>
              ) : result.data.status === "open" ? (
                <JoinForm code={code} />
              ) : (
                <p className="font-sans text-[15px] text-ink-muted">This class is closed.</p>
              )}

              <section className="bg-surface border border-line rounded-[16px] p-5 md:p-6">
                <p className={EYEBROW}>The question</p>
                <p className="font-sans text-[17px] leading-[1.55] text-ink mt-1">{result.data.experiment.question}</p>
                {result.data.experiment.hypothesis.trim() && (
                  <>
                    <p className={`${EYEBROW} mt-4`}>Your teacher&apos;s hypothesis</p>
                    <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-1">{result.data.experiment.hypothesis}</p>
                  </>
                )}
              </section>
              <Design experiment={result.data.experiment} hint={`You'll run each version ${result.data.experiment.n} times${result.data.experiment.items.length ? " per item" : ""}.`} />
              {member && (
                <p className="bg-highlight-soft border border-highlight/40 rounded-[12px] px-4 py-3 font-sans text-[14px] text-ink">
                  Running it opens soon — your teacher will tell you when.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </Shell>
  );
}
