import Link from "next/link";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import { SignOutButton, TeacherSignIn } from "@/components/classroom/forms";
import { TEACHER_COOKIE, formatJoinCode } from "@/lib/classroom";
import { currentTeacher, listClasses } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Teach",
  description: "Run one experiment with a whole class and see the pooled result.",
  robots: { index: false, follow: false },
};

export default async function TeachPage() {
  const deps = classDeps();
  const teacher = await currentTeacher(deps, (await cookies()).get(TEACHER_COOKIE)?.value ?? null);
  const classes = teacher ? await listClasses(deps, teacher) : null;

  return (
    <Shell>
      <section className="mx-auto max-w-[960px] px-6 md:px-12 pt-16 md:pt-20 pb-32">
        <SectionNumber>Teach</SectionNumber>
        <h1 className="font-display text-[48px] md:text-[64px] leading-[1.0] tracking-tight text-ink mt-6">
          One experiment, <span className="italic">a whole class</span>.
        </h1>
        <p className="font-sans text-[15px] leading-[1.6] text-ink-muted max-w-2xl mt-5">
          Every student runs the same experiment and the results pool together. One student&apos;s handful of runs is an
          anecdote; thirty students&apos; is evidence — and seeing the spread is the lesson.
        </p>

        <div className="mt-12">
          {!deps.config.enabled ? (
            <p className="font-sans text-[15px] text-ink-muted" data-testid="teach-off">
              Classrooms aren&apos;t open yet.
            </p>
          ) : !teacher ? (
            <TeacherSignIn />
          ) : (
            <div className="flex flex-col gap-8" data-testid="teach-dashboard">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-sans text-[14px] text-ink-muted">
                  Signed in as <span className="text-ink">{teacher.email}</span>
                </p>
                <SignOutButton />
              </div>

              <div className="bg-surface border border-line rounded-[16px] p-6">
                <h2 className="font-display text-[26px] leading-[1.15] text-ink">Make a class</h2>
                <p className="font-sans text-[14px] leading-[1.6] text-ink-muted mt-2 max-w-2xl">
                  Set up the experiment in the lab — or start from a template — then choose <em>Make a class</em> at the bottom.
                  The class gets a code students type in; the design is locked so everyone runs the same thing.
                </p>
                <Link
                  href="/lab"
                  className="inline-flex items-center gap-2 mt-4 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] hover:bg-ink/90 transition-colors"
                >
                  Open the lab <span className="text-highlight">→</span>
                </Link>
              </div>

              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mb-3">Your classes</p>
                {classes?.status === "unavailable" ? (
                  <p className="font-sans text-[14px] text-ink-muted">Couldn&apos;t load your classes right now. Refresh in a minute.</p>
                ) : classes?.status === "ok" && classes.data.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {classes.data.map((c) => (
                      <li key={c.code}>
                        <Link
                          href={`/teach/classes/${c.code}`}
                          className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line rounded-[12px] px-4 py-3 hover:border-ink transition-colors"
                        >
                          <span className="font-sans text-[15px] text-ink">{c.title}</span>
                          <span className="font-mono text-[12px] text-ink-muted">
                            {formatJoinCode(c.code)} · {c.members} {c.members === 1 ? "student" : "students"} · {c.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="font-sans text-[14px] text-ink-muted">No classes yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </Shell>
  );
}
