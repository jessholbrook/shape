import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { SectionNumber } from "@/components/section-number";
import QRCode from "qrcode";
import { Design } from "@/components/lab/shared-view";
import { ClassStatusButton, CopyLink } from "@/components/classroom/forms";
import { ClassResults } from "@/components/classroom/class-results";
import { TEACHER_COOKIE, deletionDate, formatDay, formatJoinCode } from "@/lib/classroom";
import { currentTeacher, loadTeacherClass } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";
import { loadTeacherRuns } from "@/lib/server/class-results";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Class", robots: { index: false, follow: false } };

const EYEBROW = "font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet";

function closedText(closedAt: string | null): string {
  const deleted = deletionDate(closedAt);
  const closed = closedAt ? ` on ${formatDay(new Date(closedAt))}` : "";
  return deleted
    ? `Closed${closed}: no new runs. The class and every run in it will be deleted on ${formatDay(deleted)} — download them before then to keep them. Reopening stops the clock.`
    : `Closed${closed}: no new runs. Everyone can still see the results.`;
}

export default async function TeacherClassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const deps = classDeps();
  const teacher = await currentTeacher(deps, (await cookies()).get(TEACHER_COOKIE)?.value ?? null);
  if (!teacher) redirect("/teach");
  const [result, runs] = await Promise.all([loadTeacherClass(deps, teacher, code), loadTeacherRuns(deps, teacher, code)]);
  if (result.status === "missing") notFound();

  const host = (await headers()).get("host") ?? "shape-models.com";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const joinUrl = result.status === "ok" ? `${proto}://${host}/class/${result.data.code}` : "";
  // Generated here from our own URL — not user input — so rendering the SVG markup is safe.
  const qr = joinUrl ? await QRCode.toString(joinUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : "";
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
                <div className="mt-6 pt-5 border-t border-line flex flex-wrap items-center gap-5" data-testid="class-join-link">
                  <div
                    className="w-[120px] h-[120px] bg-white rounded-[8px] p-1 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                    role="img"
                    aria-label={`QR code for ${joinUrl}`}
                    dangerouslySetInnerHTML={{ __html: qr }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={EYEBROW}>Or share the link — it skips the code</p>
                    <p className="font-mono text-[13px] text-ink mt-1 break-all">{joinUrl}</p>
                    <div className="mt-2">
                      <CopyLink url={joinUrl} />
                    </div>
                  </div>
                </div>
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
                      <li
                        key={m.nickname}
                        className="font-sans text-[13px] text-ink bg-canvas border border-line rounded-full px-3 py-1"
                        title={m.runs ? `${m.recorded} of ${m.runs} runs recorded by Shape` : "No runs yet"}
                      >
                        {m.nickname}
                        <span className="text-ink-quiet"> · {m.runs ? `${m.runs} runs` : "no runs yet"}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="font-sans text-[12px] text-ink-quiet mt-4">
                  Allowance: {result.data.daily_calls.toLocaleString()} free model calls a day for the class.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3" data-testid="class-actions">
              <p className="font-sans text-[14px] text-ink-muted">
                {result.data.status === "open"
                  ? "Open: students can join and run the experiment."
                  : closedText(result.data.closed_at)}
              </p>
              <ClassStatusButton code={result.data.code} status={result.data.status} />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Download every run:{" "}
                <a href={`/api/teach/classes/${result.data.code}/export?format=csv`} className="text-ink underline decoration-highlight underline-offset-4" download>
                  CSV
                </a>{" "}
                ·{" "}
                <a href={`/api/teach/classes/${result.data.code}/export?format=json`} className="text-ink underline decoration-highlight underline-offset-4" download>
                  JSON
                </a>
              </span>
            </div>

            <div className="mt-6">
              {runs.status === "ok" ? (
                <ClassResults experiment={result.data.experiment} rows={runs.data} view="teacher" />
              ) : (
                <p className="font-sans text-[14px] text-ink-muted">Couldn&apos;t load the class&apos;s runs right now. Refresh in a minute.</p>
              )}
            </div>

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
