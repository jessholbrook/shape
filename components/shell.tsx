"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShapeMark } from "./shape-mark";
import { CostMeter } from "./cost-meter";
import { FeedbackButton } from "./feedback-button";
import { WebLLMStatusBanner } from "./webllm-status-banner";
import { hasUnsavedWork, clearUnsavedWork } from "@/lib/hooks/use-unsaved-work";

const LEAVE_CONFIRM =
  "You have unsaved output in this session. Leave without saving it? Use the Save draft bar at the bottom to keep it.";

type NavItem = {
  num: string;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { num: "01", label: "Home", href: "/" },
  { num: "02", label: "Learn", href: "/learn" },
  { num: "03", label: "Play", href: "/play" },
  { num: "04", label: "Notebook", href: "/notebook" },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [menuOpen, setMenuOpen] = useState(false);

  // Esc closes the menu; lock body scroll while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  // Guard in-app navigation when a playground has unsaved output. Capture-phase
  // so we intercept any internal link click (nav, brand, in-page CTAs) before
  // Next's Link handles it. New-tab and modified clicks pass through untouched.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!hasUnsavedWork()) return;
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank") return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/")) return;
      const dest = href.split(/[?#]/)[0];
      if (dest === window.location.pathname) return; // same page (e.g. ?draft=)
      if (window.confirm(LEAVE_CONFIRM)) {
        clearUnsavedWork();
      } else {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Mobile top bar (visible below md) */}
      <div
        data-print-hide
        className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-canvas/90 backdrop-blur border-b border-line px-6 py-4"
      >
        <Link href="/" className="flex items-center gap-2">
          <ShapeMark size={22} className="text-ink" />
          <span className="font-display text-[18px] leading-none tracking-tight">
            Shape
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-menu"
          className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-ink hover:bg-line/40 transition-colors"
        >
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/* Mobile menu */}
      <MobileMenu
        open={menuOpen}
        pathname={pathname}
        onClose={() => setMenuOpen(false)}
      />

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

        {/* Nav */}
        <div className="px-8 mt-4">
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

        {/* Bottom: cost meter + keys */}
        <div className="mt-auto px-6 pb-6 space-y-3">
          <CostMeter />
          <div className="px-2">
            <Link
              href="/settings/keys"
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              Keys
            </Link>
          </div>
        </div>
      </aside>

      {/* Page content */}
      <main className="md:ml-[240px]">{children}</main>

      <FeedbackButton />
      <WebLLMStatusBanner />
    </div>
  );
}

function MobileMenu({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        data-print-hide
        onClick={onClose}
        aria-hidden
        className={`md:hidden fixed inset-0 z-30 bg-ink/30 backdrop-blur-sm transition-opacity ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Panel */}
      <div
        id="mobile-nav-menu"
        data-print-hide
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        className={`md:hidden fixed inset-x-0 top-0 z-40 bg-canvas border-b border-line shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-out ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <Link href="/" className="flex items-center gap-2">
            <ShapeMark size={22} className="text-ink" />
            <span className="font-display text-[18px] leading-none tracking-tight">
              Shape
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex items-center justify-center w-9 h-9 rounded-[8px] text-ink hover:bg-line/40 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="px-6 py-4">
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <NavRow
                key={item.num}
                item={item}
                active={isActive(item.href, pathname)}
                onNavigate={onClose}
              />
            ))}
          </ul>
        </nav>

        <div className="px-6 pb-6 pt-2 border-t border-line space-y-3">
          <CostMeter />
          <div className="px-2">
            <Link
              href="/settings/keys"
              onClick={onClose}
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
            >
              Keys
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
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

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
