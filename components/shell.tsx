"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShapeMark } from "./shape-mark";
import { CostMeter } from "./cost-meter";
import { BUILD_ENABLED } from "@/lib/flags";

type NavItem = {
  num: string;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { num: "01", label: "Home", href: "/" },
  { num: "02", label: "Play", href: "/play" },
  ...(BUILD_ENABLED
    ? [{ num: "03", label: "Build", href: "/build" } as NavItem]
    : []),
  { num: BUILD_ENABLED ? "04" : "03", label: "Learn", href: "/learn" },
];

const personalItems: NavItem[] = [
  { num: BUILD_ENABLED ? "05" : "04", label: "Notebook", href: "/notebook" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <div className="min-h-screen">
      {/* Mobile top bar (visible below md) */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-canvas/90 backdrop-blur border-b border-line px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <ShapeMark size={22} className="text-ink" />
          <span className="font-display text-[18px] leading-none tracking-tight">
            Shape
          </span>
        </Link>
        <Link
          href="/login"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
        >
          Sign in
        </Link>
      </div>

      {/* Left nav (desktop) */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[240px] flex-col border-r border-line bg-canvas/60 backdrop-blur-sm z-20">
        {/* Brand */}
        <div className="px-8 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 group"
          >
            <ShapeMark
              size={26}
              className="text-ink group-hover:opacity-90 transition-opacity"
            />
            <span className="font-display text-[22px] leading-none tracking-tight text-ink">
              Shape
            </span>
          </Link>
        </div>

        {/* Workspace section */}
        <div className="px-8 mt-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet mb-3">
            Workspace
          </div>
          <ul className="space-y-1">
            {navItems.map((item) => (
              <NavRow
                key={item.num}
                item={item}
                active={isActive(item.href, pathname)}
              />
            ))}
          </ul>
        </div>

        {/* Personal section */}
        <div className="px-8 mt-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet mb-3">
            Personal
          </div>
          <ul className="space-y-1">
            {personalItems.map((item) => (
              <NavRow
                key={item.num}
                item={item}
                active={isActive(item.href, pathname)}
              />
            ))}
          </ul>
        </div>

        {/* Bottom: cost meter + auth */}
        <div className="mt-auto px-6 pb-6 space-y-3">
          <CostMeter />
          <div className="flex items-center justify-between px-2">
            <Link
              href="/settings/keys"
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              Keys
            </Link>
            <Link
              href="/login"
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Sign in
            </Link>
          </div>
        </div>
      </aside>

      {/* Page content */}
      <main className="md:ml-[240px]">{children}</main>
    </div>
  );
}

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-[8px] px-2 py-1.5 -mx-2 transition-colors ${
          active
            ? "text-ink"
            : "text-ink-muted hover:text-ink hover:bg-line/40"
        }`}
      >
        <span
          className={`font-mono text-[11px] tracking-[0.08em] ${
            active ? "text-highlight" : "text-ink-quiet"
          }`}
        >
          {item.num}
        </span>
        <span
          className={`font-sans text-[14px] ${active ? "font-medium" : ""}`}
        >
          {item.label}
        </span>
        {active && (
          <span className="ml-auto w-1 h-1 rounded-full bg-highlight" />
        )}
      </Link>
    </li>
  );
}
