// Currents News API adapter — raw headlines for the Headlines feed.
//
// Founder decision 2026-06-12: one free news API is approved as the
// raw-headline source for the Headlines surface, replacing web_search for
// the GATHERING step only (≈$10–20/mo saved). Council/Sweep and Headline
// Decoder keep web_search — provenance-validated citations can't come from
// an aggregator. CLAUDE.md Data architecture has the amended rule.
//
// License obligations (currentsapi.services/terms — these are load-bearing):
//  - Attribution must render beside displayed data. Use ATTRIBUTION below.
//  - No permanent copies/databases of their data: the Supabase headline
//    cache must stay ROLLING — each refresh overwrites, never archives.
//
// Free-tier budget: 1000 req/day. The 2×/day × ~11-region refresh uses ~25,
// so quota is never the constraint. Like the other dormant adapters, this
// throws non-retryably until CURRENTS_API_KEY is set in the environment.
//
// Endpoint notes (live-tested 2026-06-12):
//  - /v1/search with category/country/keywords is reliable.
//  - /v1/latest-news intermittently answers {"status":"400","msg":"Database
//    error occurred"} even with a valid key, so search is the only endpoint
//    we call.
//  - 401 = bad key (non-retryable — don't hammer it). Treat any non-"ok"
//    status as a provider failure; the UI says "data unavailable", never
//    synthetic headlines.

const BASE = "https://api.currentsapi.services/v1";
const TIMEOUT_MS = 8_000;

// Render this verbatim, hyperlinked, beside any list of Currents headlines.
export const ATTRIBUTION = {
  label: "Powered by Currents News API",
  url: "https://currentsapi.services",
} as const;

export interface NewsHeadline {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string; // hostname of the article URL — Currents has no source field
  publishedAt: string; // ISO 8601
}

export interface HeadlineQuery {
  // Currents categories: "finance" | "business" | "technology" | ... — the
  // feed job maps region tabs onto category/country/keywords combinations.
  category?: string;
  country?: string; // ISO 3166-1 alpha-2, e.g. "US"
  keywords?: string;
  language?: string; // default "en"
  limit?: number; // free tier returns up to 30 per request
}

export class CurrentsError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(`[news:currents] ${message}`);
    this.name = "CurrentsError";
  }
}

function apiKey(): string {
  return (process.env.CURRENTS_API_KEY ?? "").trim();
}

export function currentsConfigured(): boolean {
  return apiKey().length > 0;
}

interface CurrentsArticle {
  id?: string;
  title?: string;
  description?: string;
  url?: string;
  published?: string; // "2026-06-12 06:27:21 +0000"
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Currents timestamps are "YYYY-MM-DD HH:mm:ss +0000" — not ISO. Normalize
// so consumers can `new Date()` it without knowing the quirk.
function toIso(published: string | undefined): string {
  if (!published) return "";
  const d = new Date(published.replace(" +0000", "Z").replace(" ", "T"));
  return isNaN(d.getTime()) ? "" : d.toISOString();
}

export function mapArticles(raw: CurrentsArticle[]): NewsHeadline[] {
  return raw
    .filter((a) => a.title && a.url)
    .map((a) => ({
      id: a.id ?? a.url!,
      title: a.title!.trim(),
      description: (a.description ?? "").trim(),
      url: a.url!,
      source: hostOf(a.url!),
      publishedAt: toIso(a.published),
    }));
}

export async function fetchHeadlines(query: HeadlineQuery = {}): Promise<NewsHeadline[]> {
  const key = apiKey();
  if (!key) {
    throw new CurrentsError("CURRENTS_API_KEY not set — adapter dormant", false);
  }

  const params = new URLSearchParams({ language: query.language ?? "en" });
  if (query.category) params.set("category", query.category);
  if (query.country) params.set("country", query.country);
  if (query.keywords) params.set("keywords", query.keywords);
  params.set("apiKey", key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}/search?${params}`, { signal: controller.signal });
  } catch (err) {
    throw new CurrentsError(
      `network failure: ${err instanceof Error ? err.message : String(err)}`,
      true
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) {
    throw new CurrentsError("invalid API key (401)", false);
  }
  if (res.status === 429) {
    throw new CurrentsError("rate limited (429) — free tier is 1000 req/day", true);
  }
  if (!res.ok) {
    throw new CurrentsError(`HTTP ${res.status}`, true);
  }

  const body = (await res.json()) as { status?: string; news?: CurrentsArticle[] };
  if (body.status !== "ok" || !Array.isArray(body.news)) {
    throw new CurrentsError(`provider error: status=${body.status ?? "missing"}`, true);
  }

  const headlines = mapArticles(body.news);
  console.log(
    `[news:currents] fetched ${headlines.length} headlines (${params.toString().replace(/apiKey=[^&]+/, "apiKey=***")})`
  );
  return typeof query.limit === "number" ? headlines.slice(0, query.limit) : headlines;
}
