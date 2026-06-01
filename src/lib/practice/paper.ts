// Conviqt Academy — Practice: the live paper-trading layer (server-only).
//
// Two halves:
//   1. fetchQuote — a Haiku + web_search agent that returns ONE real, cited
//      current price for a ticker. Same provenance discipline as the sweep
//      agent: the source URL must appear in the actual web_search results, or
//      we reject the quote. No citation, no number (per CLAUDE.md).
//   2. The position store — open / list / mark-to-market / close on
//      practice_paper_positions. Marks are stamped with the quote's source URL.
//
// Quote fetches (open + each mark) are metered at paper_mark credits upstream;
// listing/closing is free (no model spend).

import { getAnthropic, MODELS, WEB_SEARCH_TOOL, estimateCallCostUSD } from "../anthropic";
import { normalizeUrl } from "../url-normalize";
import { getSupabaseAdmin } from "../supabase";
import type { PaperQuote, PaperPosition } from "./types";

// ── Quote agent ────────────────────────────────────────────────────────────────

const QUOTE_SYSTEM = `You are a market-data fetcher for Conviqt's paper-trading desk. Given ONE US-listed ticker, find its most recent trading price and report it with a source.

Procedure:
1. Use the web_search tool (you have up to 2 searches) to find the latest price, e.g. "{TICKER} stock price today".
2. Then call report_quote ONCE with the price, an "as of" freshness label, and the sources you used.

Rules:
- The sources array MUST contain the exact URL(s) from your web_search results — copy them verbatim. The post-processor verifies every URL against the real search results and rejects any that didn't appear.
- price is a plain number in USD (no currency symbol, no commas).
- as_of is a short human label, e.g. "close 2026-05-30" or "intraday 2026-05-31 14:05 ET".
- source_index points into your sources array.
- Never invent a price or a URL. If you cannot find a real quote, return price 0 with an empty sources array.`;

const REPORT_QUOTE_TOOL = {
  name: "report_quote",
  description: "Emit the current price for the requested ticker, cited to a web_search source URL.",
  input_schema: {
    type: "object" as const,
    properties: {
      price: { type: "number", description: "Latest price in USD as a plain number. 0 if not found." },
      as_of: { type: "string", description: "Human freshness label, e.g. 'close 2026-05-30'." },
      source_index: { type: "number", description: "Zero-based index into sources." },
      sources: {
        type: "array",
        description: "URLs from your web_search results. Copy each URL exactly.",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
          },
          required: ["url", "title"],
        },
      },
    },
    required: ["price", "as_of", "source_index", "sources"],
  },
};

interface ContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

interface WebSearchResultLike {
  url?: string;
  title?: string;
  type?: string;
}

function extractCanonicalUrls(content: ContentBlock[]): Map<string, { url: string; title: string }> {
  const map = new Map<string, { url: string; title: string }>();
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    const inner = block.content;
    if (!Array.isArray(inner)) continue;
    for (const result of inner as WebSearchResultLike[]) {
      if (result.type !== "web_search_result") continue;
      if (typeof result.url !== "string") continue;
      const norm = normalizeUrl(result.url);
      if (!norm || map.has(norm)) continue;
      map.set(norm, { url: result.url, title: typeof result.title === "string" ? result.title : result.url });
    }
  }
  return map;
}

export interface QuoteResult {
  quote: PaperQuote | null;
  costUSD: number;
  webSearchCount: number;
  durationMs: number;
}

export async function fetchQuote(ticker: string): Promise<QuoteResult> {
  const t0 = Date.now();
  const symbol = ticker.trim().toUpperCase();
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.sweep,
    max_tokens: 1024,
    system: QUOTE_SYSTEM,
    tools: [WEB_SEARCH_TOOL, REPORT_QUOTE_TOOL],
    messages: [
      {
        role: "user",
        content: `Ticker: ${symbol}\n\nSearch for the latest price now, then call report_quote.`,
      },
    ],
  });

  const content = response.content as unknown as ContentBlock[];
  let webSearchCount = 0;
  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") webSearchCount += 1;
  }

  const toolUse = content.find((b) => b.type === "tool_use" && b.name === REPORT_QUOTE_TOOL.name);
  const costUSD = estimateCallCostUSD(MODELS.sweep, response.usage, webSearchCount);

  if (!toolUse || toolUse.type !== "tool_use") {
    console.error(`[paper] ${symbol}: no report_quote call (stop=${response.stop_reason})`);
    return { quote: null, costUSD, webSearchCount, durationMs: Date.now() - t0 };
  }

  const input = toolUse.input as {
    price: number;
    as_of: string;
    source_index: number;
    sources: Array<{ url: string; title: string }>;
  };

  const price = Number(input.price);
  if (!price || price <= 0) {
    console.error(`[paper] ${symbol}: no valid price returned`);
    return { quote: null, costUSD, webSearchCount, durationMs: Date.now() - t0 };
  }

  // Validate the cited source against the URLs web_search actually returned.
  const canonical = extractCanonicalUrls(content);
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const idx = typeof input.source_index === "number" ? input.source_index : 0;
  const claimed = sources[idx] ?? sources[0];
  let verified: { url: string; title: string } | null = null;
  if (claimed) {
    const norm = normalizeUrl(claimed.url);
    if (norm && canonical.has(norm)) verified = canonical.get(norm)!;
  }
  if (!verified) {
    // Fall back to any verified source the model listed.
    for (const s of sources) {
      const norm = normalizeUrl(s.url);
      if (norm && canonical.has(norm)) {
        verified = canonical.get(norm)!;
        break;
      }
    }
  }

  if (!verified) {
    console.error(`[paper] ${symbol}: price $${price} had no verifiable source — rejected`);
    return { quote: null, costUSD, webSearchCount, durationMs: Date.now() - t0 };
  }

  const quote: PaperQuote = {
    ticker: symbol,
    price: Math.round(price * 100) / 100,
    asOf: String(input.as_of ?? "").trim() || "latest",
    sourceUrl: verified.url,
    sourceTitle: verified.title,
  };
  console.log(`[paper] ${symbol} quote $${quote.price} (${quote.asOf}) cost=$${costUSD.toFixed(4)}`);
  return { quote, costUSD, webSearchCount, durationMs: Date.now() - t0 };
}

// ── Position store ───────────────────────────────────────────────────────────────

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface RawPositionRow {
  id: string;
  ticker: string;
  qty: number;
  entry_price: number;
  entry_source: string | null;
  entry_as_of: string | null;
  stop_price: number | null;
  target_price: number | null;
  thesis: string | null;
  last_mark: number | null;
  last_mark_src: string | null;
  last_mark_at: string | null;
  status: string;
  exit_price: number | null;
  closed_at: string | null;
  opened_at: string;
}

function toPosition(r: RawPositionRow): PaperPosition {
  const mark = r.status === "closed" ? r.exit_price : r.last_mark;
  const marketValue = typeof mark === "number" ? Math.round(mark * Number(r.qty) * 100) / 100 : null;
  const unrealizedPct =
    typeof mark === "number" && Number(r.entry_price) > 0
      ? Math.round(((mark - Number(r.entry_price)) / Number(r.entry_price)) * 10000) / 100
      : null;
  return {
    id: r.id,
    ticker: r.ticker,
    qty: Number(r.qty),
    entryPrice: Number(r.entry_price),
    entrySource: r.entry_source,
    entryAsOf: r.entry_as_of,
    stopPrice: r.stop_price === null ? null : Number(r.stop_price),
    targetPrice: r.target_price === null ? null : Number(r.target_price),
    thesis: r.thesis,
    lastMark: r.last_mark === null ? null : Number(r.last_mark),
    lastMarkSrc: r.last_mark_src,
    lastMarkAt: r.last_mark_at,
    status: r.status === "closed" ? "closed" : "open",
    exitPrice: r.exit_price === null ? null : Number(r.exit_price),
    closedAt: r.closed_at,
    openedAt: r.opened_at,
    marketValue,
    unrealizedPct,
  };
}

export async function listPaperPositions(email: string): Promise<PaperPosition[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("practice_paper_positions")
      .select(
        "id, ticker, qty, entry_price, entry_source, entry_as_of, stop_price, target_price, thesis, last_mark, last_mark_src, last_mark_at, status, exit_price, closed_at, opened_at",
      )
      .eq("email", email.toLowerCase().trim())
      .order("opened_at", { ascending: false });
    if (error) {
      console.error("[paper] listPaperPositions error:", error.message);
      return [];
    }
    return ((data ?? []) as RawPositionRow[]).map(toPosition);
  } catch (err) {
    console.error("[paper] listPaperPositions unavailable:", msg(err));
    return [];
  }
}

export interface OpenPositionInput {
  ticker: string;
  qty: number;
  entryPrice: number;
  entrySource?: string | null;
  entryAsOf?: string | null;
  stopPrice?: number | null;
  targetPrice?: number | null;
  thesis?: string | null;
}

export async function openPaperPosition(
  email: string,
  input: OpenPositionInput,
): Promise<PaperPosition | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("practice_paper_positions")
      .insert({
        email: email.toLowerCase().trim(),
        ticker: input.ticker.trim().toUpperCase(),
        qty: input.qty,
        entry_price: input.entryPrice,
        entry_source: input.entrySource ?? null,
        entry_as_of: input.entryAsOf ?? null,
        stop_price: input.stopPrice ?? null,
        target_price: input.targetPrice ?? null,
        thesis: input.thesis ?? null,
        last_mark: input.entryPrice,
        last_mark_src: input.entrySource ?? null,
        last_mark_at: new Date().toISOString(),
        status: "open",
      })
      .select(
        "id, ticker, qty, entry_price, entry_source, entry_as_of, stop_price, target_price, thesis, last_mark, last_mark_src, last_mark_at, status, exit_price, closed_at, opened_at",
      )
      .single();
    if (error) {
      console.error("[paper] openPaperPosition error:", error.message);
      return null;
    }
    return toPosition(data as RawPositionRow);
  } catch (err) {
    console.error("[paper] openPaperPosition unavailable:", msg(err));
    return null;
  }
}

// Marks an open position to a fresh, cited quote. Returns the updated position.
export async function markPaperPosition(
  email: string,
  id: string,
  quote: PaperQuote,
): Promise<PaperPosition | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("practice_paper_positions")
      .update({
        last_mark: quote.price,
        last_mark_src: quote.sourceUrl,
        last_mark_at: new Date().toISOString(),
      })
      .eq("email", email.toLowerCase().trim())
      .eq("id", id)
      .eq("status", "open")
      .select(
        "id, ticker, qty, entry_price, entry_source, entry_as_of, stop_price, target_price, thesis, last_mark, last_mark_src, last_mark_at, status, exit_price, closed_at, opened_at",
      )
      .single();
    if (error) {
      console.error("[paper] markPaperPosition error:", error.message);
      return null;
    }
    return toPosition(data as RawPositionRow);
  } catch (err) {
    console.error("[paper] markPaperPosition unavailable:", msg(err));
    return null;
  }
}

// Closes a position at the given exit price (typically the latest mark).
export async function closePaperPosition(
  email: string,
  id: string,
  exitPrice: number,
): Promise<PaperPosition | null> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("practice_paper_positions")
      .update({
        status: "closed",
        exit_price: exitPrice,
        closed_at: new Date().toISOString(),
      })
      .eq("email", email.toLowerCase().trim())
      .eq("id", id)
      .eq("status", "open")
      .select(
        "id, ticker, qty, entry_price, entry_source, entry_as_of, stop_price, target_price, thesis, last_mark, last_mark_src, last_mark_at, status, exit_price, closed_at, opened_at",
      )
      .single();
    if (error) {
      console.error("[paper] closePaperPosition error:", error.message);
      return null;
    }
    return toPosition(data as RawPositionRow);
  } catch (err) {
    console.error("[paper] closePaperPosition unavailable:", msg(err));
    return null;
  }
}
