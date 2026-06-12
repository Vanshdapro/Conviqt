// CSV → holdings parser for the Portfolio surface (client-safe, no deps).
//
// Accepts the files brokers actually export: comma/semicolon/tab delimited,
// with or without a header row, quoted fields tolerated. We only ever read
// three columns — ticker/symbol, shares/quantity, cost basis (optional) —
// and ignore everything else. Rows that don't parse are counted and reported
// honestly, never silently dropped without a number the user can see.

export interface ParsedHolding {
  ticker: string;
  shares: number;
  costBasis?: number;
}

export interface CsvParseResult {
  holdings: ParsedHolding[];
  /** data rows that could not be parsed into a valid holding */
  skipped: number;
  /** fatal problem with the whole file (empty, no recognizable columns) */
  error: string | null;
}

// Mirrors sanitizeHoldings in src/lib/portfolio/store.ts — same universe of
// acceptable tickers, same 40-holding cap.
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const MAX_ROWS = 40;

const TICKER_HEADERS = /^(ticker|symbol|stock|holding)s?$/i;
const SHARES_HEADERS = /^(shares?|quantity|qty|units?|amount)$/i;
const COST_HEADERS = /^(cost ?basis|avg ?cost|average ?cost|cost|price ?paid|purchase ?price|buy ?price|unit ?cost)$/i;

/** Split one CSV line on the delimiter, honoring double-quoted fields. */
function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

function detectDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  if ((line.match(/;/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0)) return ";";
  return ",";
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[$,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseHoldingsCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { holdings: [], skipped: 0, error: "That file is empty." };
  }

  const delim = detectDelimiter(lines[0]);
  const first = splitLine(lines[0], delim);

  // Column mapping: from a header row when there is one, positional otherwise
  // (ticker, shares, cost basis — the format our empty state documents).
  let tickerCol = 0;
  let sharesCol = 1;
  let costCol: number | null = 2;
  let dataStart = 0;

  const headerTickerCol = first.findIndex((c) => TICKER_HEADERS.test(c));
  if (headerTickerCol >= 0) {
    tickerCol = headerTickerCol;
    const s = first.findIndex((c) => SHARES_HEADERS.test(c));
    if (s < 0) {
      return {
        holdings: [],
        skipped: 0,
        error: "Found a ticker column but no shares/quantity column.",
      };
    }
    sharesCol = s;
    const c = first.findIndex((col) => COST_HEADERS.test(col));
    costCol = c >= 0 ? c : null;
    dataStart = 1;
  }

  const seen = new Set<string>();
  const holdings: ParsedHolding[] = [];
  let skipped = 0;

  for (let i = dataStart; i < lines.length; i++) {
    const cols = splitLine(lines[i], delim);
    const ticker = (cols[tickerCol] ?? "").toUpperCase();
    const shares = parseNumber(cols[sharesCol]);
    if (!TICKER_RE.test(ticker) || shares === null || shares <= 0) {
      skipped++;
      continue;
    }
    if (seen.has(ticker)) {
      skipped++;
      continue;
    }
    seen.add(ticker);
    const cost = costCol !== null ? parseNumber(cols[costCol]) : null;
    holdings.push({
      ticker,
      shares,
      ...(cost !== null && cost > 0 ? { costBasis: cost } : {}),
    });
    if (holdings.length >= MAX_ROWS) break;
  }

  if (holdings.length === 0) {
    return {
      holdings,
      skipped,
      error:
        "No holdings found. Expected columns: ticker, shares, and (optionally) cost basis per share.",
    };
  }
  return { holdings, skipped, error: null };
}
