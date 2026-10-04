import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { Design } from "@/components/lab/shared-view";
import { TEACHER_COOKIE, formatJoinCode } from "@/lib/classroom";
import { currentTeacher, loadTeacherClass } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class", robots: { index: false, follow: false } };

const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet";

export default async function TeacherClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const deps = classDeps();
  const teacher = await currentTeacher(deps, (await cookies()).get(TEACHER_COOKIE)?.value ?? null);
  if (!teacher) redirect("/teach");
  const result = await loadTeacherClass(deps, teacher, code);
  if (result.status === "missing") notFound();

  const host = (await headers()).get("host") ?? "shape-models.com";
  return (
    <Shell>
      <section className="mx-auto max-w-[1100px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <Link href="/teach" className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink">
          ← Your classes
        </Link>
        {result.status === "unavailable" ? (
          <p className="font-sans text-[15px] text-ink-muted mt-8">Couldn&apos;t load this class right now. Refresh in a minute.</p>
        ) : (
          <>
            <div className="mt-6">
              <SectionNumber>{`Class · ${result.data.status}`}</SectionNumber>
            </div>
            <h1 className="font-display text-[40px] md:text-[56px] leading-[1.05] tracking-tight text-ink mt-6">{result.data.title}</h1>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-4">
              <div className="bg-surface border border-line rounded-[16px] p-6" data-testid="class-code">
                <p className={EYEBROW}>Students go to</p>
                <p className="font-mono text-[18px] text-ink mt-2 break-all">
                  {host}/class
                </p>
                <p className={`${EYEBROW} mt-4`}>and type the code</p>
                <p className="font-mono text-[48px] md:text-[56px] leading-none tracking-[0.12em] text-ink mt-2">{formatJoinCode(result.data.code)}</p>
              </div>
              <div className="bg-surface border border-line rounded-[16px] p-6">
                <p className={EYEBROW}>
                  Joined ({result.data.members.length})
                </p>
                {result.data.members.length === 0 ? (
                  <p className="font-sans text-[14px] text-ink-muted mt-2">Nobody yet. Refresh once students have joined.</p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {result.data.members.map((m) => (
                      <li key={m.nickname} className="font-sans text-[13px] text-ink bg-canvas border border-line rounded-full px-3 py-1">
                        {m.nickname}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="font-sans text-[12px] text-ink-quiet mt-4">
                  Allowance: {result.data.daily_calls.toLocaleString()} free model calls a day for the class.
                </p>
              </div>
            </div>

            <p className="mt-6 bg-highlight-soft border border-highlight/40 rounded-[12px] px-4 py-3 font-sans text-[14px] text-ink">
              Students can join now. Running the experiment in class, and the pooled results, arrive in the next update.
            </p>

            <div className="mt-6 flex flex-col gap-6">
              <section className="bg-surface border border-line rounded-[16px] p-5 md:p-6">
                <p className={EYEBROW}>The question</p>
                <p className="font-sans text-[17px] leading-[1.55] text-ink mt-1">{result.data.experiment.question}</p>
                {result.data.experiment.hypothesis.trim() && (
                  <>
                    <p className={`${EYEBROW} mt-4`}>Your hypothesis — locked</p>
                    <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-1">{result.data.experiment.hypothesis}</p>
                  </>
                )}
              </section>
              <Design experiment={result.data.experiment} hint={`Each student runs each version ${result.data.experiment.n} times${result.data.experiment.items.length ? " per item" : ""}.`} />
            </div>
          </>
        )}
      </section>
    </Shell>
  );
}
