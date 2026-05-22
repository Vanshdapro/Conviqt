import type { MetadataRoute } from "next";

// Robots policy.
// Public site is fair game for indexing — that's how analysts and
// students find Conviqt. But the API surface (chat, analyze, pick) costs
// real money on every request, so we explicitly disallow crawlers there.
// Otherwise a single googlebot pass could blow the daily wallet.

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://conviqt.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/api/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
