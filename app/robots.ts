import type { MetadataRoute } from "next";

function origin(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : `https://${process.env.NEXT_PUBLIC_SITE_URL}`;
  }
  return "https://shape-models.com";
}

export default function robots(): MetadataRoute.Robots {
  const base = origin().replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Per-browser or non-content surfaces — nothing to index.
      disallow: ["/api/", "/print/", "/settings/", "/notebook"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
