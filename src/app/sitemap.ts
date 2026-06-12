import type { MetadataRoute } from "next";
import { getStockReportStore } from "@/lib/stockReports";
import { getCompareReportStore } from "@/lib/compareReports";
import { comparePairToSlug } from "@/lib/tickers";

const BASE = "https://www.conviqt.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Only list stock pages that have a published Council report. Empty/thin
  // placeholders are noindex (see stock/[ticker]/page.tsx) and stay out of the
  // sitemap so we don't ask Google to crawl pages with no content.
  let stockPages: MetadataRoute.Sitemap = [];
  try {
    const summaries = await getStockReportStore().listSummaries(2000);
    stockPages = summaries.map((s) => ({
      url: `${BASE}/stock/${s.ticker.toLowerCase()}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {
    // A store failure must not break the sitemap — fall back to static routes.
    stockPages = [];
  }

  // Same posture for compare pages: only the ones with a published verdict.
  // Pending pairs are noindex (see compare/[pair]/page.tsx) and stay out.
  let comparePages: MetadataRoute.Sitemap = [];
  try {
    const summaries = await getCompareReportStore().listSummaries(2000);
    comparePages = summaries.map((s) => ({
      url: `${BASE}/compare/${comparePairToSlug(s.tickerA, s.tickerB)}`,
      lastModified: new Date(s.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));
  } catch {
    comparePages = [];
  }

  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/methodology`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${BASE}/stock`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE}/compare`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE}/academy`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE}/academy/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE}/academy/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE}/academy/practice`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${BASE}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${BASE}/signup`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    ...stockPages,
    ...comparePages,
  ];
}
