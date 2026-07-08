import type { MetadataRoute } from "next";
import { MODULES } from "@/lib/curriculum";

/**
 * Public routes for crawlers. Playground and learn routes are enumerated from
 * the curriculum so this stays in sync as lessons land. The notebook, settings,
 * print, and API routes are intentionally excluded — they're per-browser or
 * non-content.
 */
function origin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : `https://${process.env.NEXT_PUBLIC_SITE_URL}`;
  }
  return "https://shape-models.com";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = origin().replace(/\/$/, "");

  const staticRoutes = ["", "/learn", "/play", "/start"].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const learnRoutes = MODULES.filter(
    (m) => m.status === "ready" && m.href.startsWith("/learn/"),
  ).map((m) => ({
    url: `${base}${m.href}`,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const playRoutes = [
    "/play/diff",
    "/play/tone",
    "/play/persona",
    "/play/refusal",
    "/play/evals",
    "/play/choreographer",
  ].map((path) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...learnRoutes, ...playRoutes];
}
