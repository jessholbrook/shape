import Link from "next/link";

const REPO_URL = "https://github.com/jessholbrook/shape";

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Use",
    links: [
      { label: "Play", href: "/play" },
      { label: "Lab", href: "/lab" },
      { label: "Notebook", href: "/notebook" },
    ],
  },
  {
    title: "Learn",
    links: [
      { label: "Lessons", href: "/learn" },
      { label: "Ways to run", href: "/start" },
      { label: "API keys", href: "/settings/keys" },
    ],
  },
  {
    title: "Teach",
    links: [
      { label: "Run a class", href: "/teach" },
      { label: "Join a class", href: "/class" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "Privacy & data", href: "/privacy" },
      { label: "Source code", href: REPO_URL, external: true },
    ],
  },
];

/** Site-wide footer: the pages a sidebar doesn't hold, and where the data goes. */
export function SiteFooter() {
  return (
    <footer className="border-t border-line mt-8" data-testid="site-footer">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12 pt-12 pb-28">
        <nav aria-label="Footer" className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">{col.title}</p>
              <ul className="mt-2 flex flex-col">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-block py-2 md:py-1 font-sans text-[14px] text-ink-muted hover:text-ink transition-colors">
                        {l.label} <span aria-hidden>↗</span>
                      </a>
                    ) : (
                      <Link href={l.href} className="inline-block py-2 md:py-1 font-sans text-[14px] text-ink-muted hover:text-ink transition-colors">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="mt-10 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Shape · No accounts for learners · Your keys stay in your browser
        </p>
      </div>
    </footer>
  );
}
