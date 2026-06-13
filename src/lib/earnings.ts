// Earnings calendar (Deliverable 3).
//
// A shared, app-wide cache of each ticker's NEXT earnings date, plus the
// web_search-backed fetcher that populates it. No new paid API — the date and
// its citation come from Claude Haiku + the web_search server tool, the same
// sole-data-source rule the rest of Conviqt follows (CLAUDE.md).
//
// The alert cron refreshes stale rows once per day and reads them to decide the
// "earnings within 48h" trigger. Cache-first: a ticker on many watchlists is
// only priced once per refresh window.

import fs from "fs";
import path from "path";
import { getOpenAI, MODELS, estimateCallCostUSD } from "./openai";
import { normalizeUrl } from "./url-normalize";
import { isSupabaseConfigured } from "./watchlist";

export type EarningsConfidence = "confirmed" | "estimated" | "unknown";

export interface EarningsEntry {
  ticker: string;
  companyName: string | null;
  nextEarningsDate: string | null; // ISO date (YYYY-MM-DD) or null if unknown
  confidence: EarningsConfidence;
  sourceUrl: string | null;
  sourceTitle: string | null;
  asOf: string; // ISO timestamp of the web_search
  updatedAt: string; // ISO
}

export interface EarningsStore {
  get(ticker: string): Promise<EarningsEntry | null>;
  getMany(tickers: string[]): Promise<Map<string, EarningsEntry>>;
  upsert(entry: EarningsEntry): Promise<void>;
}

// --------------------------------------------------------------------------
// File store (local dev)
// --------------------------------------------------------------------------

const FILE_PATH = path.resolve(process.cwd(), "data/earnings-calendar.json");

function readFile(): Record<string, EarningsEntry> {
  try {
    return JSON.parse(fs.readFileSync(FILE_PATH, "utf8")) as Record<string, EarningsEntry>;
  } catch {
    return {};
  }
}

function writeFile(map: Record<string, EarningsEntry>): void {
  fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
  fs.writeFileSync(FILE_PATH, JSON.stringify(map, null, 2), "utf8");
}

class FileEarningsStore implements EarningsStore {
  async get(ticker: string): Promise<EarningsEntry | null> {
    return readFile()[ticker.toUpperCase()] ?? null;
  }
  async getMany(tickers: string[]): Promise<Map<string, EarningsEntry>> {
    const map = readFile();
    const out = new Map<string, EarningsEntry>();
    for (const t of tickers) {
      const e = map[t.toUpperCase()];
      if (e) out.set(t.toUpperCase(), e);
    }
    return out;
  }
  async upsert(entry: EarningsEntry): Promise<void> {
    const map = readFile();
    map[entry.ticker.toUpperCase()] = entry;
    writeFile(map);
  }
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

interface Row {
  ticker: string;
  company_name: string | null;
  next_earnings_date: string | null;
  confidence: EarningsConfidence;
  source_url: string | null;
  source_title: string | null;
  as_of: string;
  updated_at: string;
}

function rowToEntry(row: Row): EarningsEntry {
  return {
    ticker: row.ticker,
    companyName: row.company_name,
    nextEarningsDate: row.next_earnings_date,
    confidence: row.confidence,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    asOf: row.as_of,
    updatedAt: row.updated_at,
  };
}

class SupabaseEarningsStore implements EarningsStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async get(ticker: string): Promise<EarningsEntry | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("earnings_calendar")
      .select("*")
      .eq("ticker", ticker.toUpperCase())
      .maybeSingle();
    if (error) throw new Error(`earnings.get ${ticker}: ${error.message}`);
    return data ? rowToEntry(data as Row) : null;
  }

  async getMany(tickers: string[]): Promise<Map<string, EarningsEntry>> {
    const out = new Map<string, EarningsEntry>();
    if (tickers.length === 0) return out;
    const db = await this.db();
    const { data, error } = await db
      .from("earnings_calendar")
      .select("*")
      .in("ticker", tickers.map((t) => t.toUpperCase()));
    if (error) throw new Error(`earnings.getMany: ${error.message}`);
    for (const r of data ?? []) {
      const entry = rowToEntry(r as Row);
      out.set(entry.ticker.toUpperCase(), entry);
    }
    return out;
  }

  async upsert(entry: EarningsEntry): Promise<void> {
    const db = await this.db();
    const row: Row = {
      ticker: entry.ticker.toUpperCase(),
      company_name: entry.companyName,
      next_earnings_date: entry.nextEarningsDate,
      confidence: entry.confidence,
      source_url: entry.sourceUrl,
      source_title: entry.sourceTitle,
      as_of: entry.asOf,
      updated_at: entry.updatedAt,
    };
    const { error } = await db
      .from("earnings_calendar")
      .upsert(row, { onConflict: "ticker" });
    if (error) throw new Error(`earnings.upsert ${entry.ticker}: ${error.message}`);
  }
}

let _store: EarningsStore | null = null;

export function getEarningsStore(): EarningsStore {
  if (_store) return _store;
  _store = isSupabaseConfigured() ? new SupabaseEarningsStore() : new FileEarningsStore();
  return _store;
}

// --------------------------------------------------------------------------
// web_search fetcher — Haiku + 1 search, structured tool output
// --------------------------------------------------------------------------

const WEB_SEARCH_TOOL_1 = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 1, // one search keeps this at ~1.5¢/ticker
};

const REPORT_EARNINGS_TOOL = {
  name: "report_earnings_date",
  description:
    "Report the next scheduled earnings (quarterly results) date for the ticker, citing the source URL your web_search returned.",
  input_schema: {
    type: "object" as const,
    properties: {
      companyName: { type: "string", description: "Full company name." },
      nextEarningsDate: {
        type: "string",
        description:
          "The NEXT upcoming earnings date in strict YYYY-MM-DD format. Must be today or in the future. Empty string if you could not find a credible upcoming date.",
      },
      confidence: {
        type: "string",
        enum: ["confirmed", "estimated", "unknown"],
        description:
          "'confirmed' if the company/exchange has officially scheduled it; 'estimated' if a provider projects it; 'unknown' if no credible date found.",
      },
      sourceUrl: {
        type: "string",
        description:
          "Exact URL from your web_search results that supports the date. Required unless confidence is 'unknown'.",
      },
      sourceTitle: { type: "string", description: "Title of that source page." },
    },
    required: ["companyName", "nextEarningsDate", "confidence"],
  },
};

interface ContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

function canonicalUrlSet(content: ContentBlock[]): Set<string> {
  const set = new Set<string>();
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    const inner = block.content;
    if (!Array.isArray(inner)) continue;
    for (const r of inner as Array<{ url?: string; type?: string }>) {
      if (r.type !== "web_search_result" || typeof r.url !== "string") continue;
      const norm = normalizeUrl(r.url);
      if (norm) set.add(norm);
    }
  }
  return set;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface FetchEarningsResult {
  entry: EarningsEntry;
  costUSD: number;
}

// Runs one web_search to find the ticker's next earnings date. Always returns
// an entry (confidence:'unknown' with a null date when nothing credible was
// found) so the caller can cache the miss and avoid hammering the same ticker.
export async function fetchEarningsDate(ticker: string): Promise<FetchEarningsResult> {
  const asOf = new Date().toISOString();
  const today = asOf.slice(0, 10);
  const anthropic = getOpenAI();

  const system = `You find the next scheduled earnings (quarterly results) date for a US-listed ticker.
Today is ${today}. Use the web_search tool exactly once with a query like "{TICKER} next earnings date".
Then call report_earnings_date ONCE.
Rules:
- nextEarningsDate must be the NEXT date that is today or later, in YYYY-MM-DD form. Never return a past date.
- Cite the exact source URL from your search results. If you cannot find a credible upcoming date, set confidence to "unknown" and leave nextEarningsDate empty.
- Do not invent a date. An estimated window (e.g. "early November") only counts if the source gives a specific projected day; otherwise use "unknown".`;

  const response = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 768,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [WEB_SEARCH_TOOL_1, REPORT_EARNINGS_TOOL],
    messages: [
      {
        role: "user",
        content: `Ticker: ${ticker.toUpperCase()}\n\nSearch now, then call report_earnings_date.`,
      },
    ],
  });

  const content = response.content as unknown as ContentBlock[];
  const webSearchCount = content.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search"
  ).length;
  const costUSD = estimateCallCostUSD(MODELS.sweep, response.usage, webSearchCount);

  const toolUse = content.find(
    (b) => b.type === "tool_use" && b.name === REPORT_EARNINGS_TOOL.name
  );

  const baseEntry: EarningsEntry = {
    ticker: ticker.toUpperCase(),
    companyName: null,
    nextEarningsDate: null,
    confidence: "unknown",
    sourceUrl: null,
    sourceTitle: null,
    asOf,
    updatedAt: asOf,
  };

  if (!toolUse || toolUse.type !== "tool_use") {
    console.warn(`[earnings] ${ticker}: no report_earnings_date call (stop=${response.stop_reason})`);
    return { entry: baseEntry, costUSD };
  }

  const input = toolUse.input as {
    companyName?: string;
    nextEarningsDate?: string;
    confidence?: EarningsConfidence;
    sourceUrl?: string;
    sourceTitle?: string;
  };

  const rawDate = (input.nextEarningsDate ?? "").trim();
  const dateValid = ISO_DATE.test(rawDate) && rawDate >= today;

  // Citation integrity: only trust a date whose source URL actually appeared in
  // the web_search results. A dated claim with an unverifiable source is dropped
  // to 'unknown' — same posture as the sweep agent.
  const canon = canonicalUrlSet(content);
  const srcUrl = (input.sourceUrl ?? "").trim();
  const srcNorm = srcUrl ? normalizeUrl(srcUrl) : null;
  const sourceVerified = !!srcNorm && canon.has(srcNorm);

  const confident =
    dateValid && sourceVerified && input.confidence !== "unknown";

  const entry: EarningsEntry = {
    ...baseEntry,
    companyName: input.companyName?.trim() || null,
    nextEarningsDate: confident ? rawDate : null,
    confidence: confident ? (input.confidence ?? "estimated") : "unknown",
    sourceUrl: confident ? srcUrl : null,
    sourceTitle: confident ? input.sourceTitle?.trim() || null : null,
  };

  if (dateValid && !sourceVerified) {
    console.warn(
      `[earnings] ${ticker}: dropped date ${rawDate} — source "${srcUrl}" not in web_search results.`
    );
  }

  return { entry, costUSD };
}
