import type { MetadataRoute } from "next";
import { MODULES } from "@/lib/curriculum";
import { PLAYGROUNDS } from "@/lib/playgrounds";

/**
 * Public routes for crawlers. Learn routes come from the curriculum and play
 * routes from the playground registry, so this stays in sync as lessons and
 * playgrounds land — a hand-kept copy of the play list had already fallen six
 * routes behind. The notebook, settings, print, and API routes are
 * intentionally excluded — they're per-browser or non-content.
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

  const playRoutes = PLAYGROUNDS.filter((p) => p.status === "ready").map(
    (p) => ({
      url: `${base}${p.href}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...learnRoutes, ...playRoutes];
}
