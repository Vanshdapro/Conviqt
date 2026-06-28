// The Map — shared type contract for the Dashboard market map (the Lens trilogy).
//
// "What the market is doing, and where the money is moving." A 2D node-graph of
// the market: index + sector + stock + macro nodes, linked by membership and
// co-movement, with a plain-English narrative. Orientation, never alpha
// (CLAUDE.md honesty guardrail): the map says "capital rotated INTO energy this
// month, here's the story" — never "buy energy."
//
// Client-safe: pure data + tiny helpers, no server imports. The deterministic
// engine lives in sectors.ts (server: marketdata.history), the narrative in
// generate.ts (server: MODELS.lens), persistence in store.ts (feed_cache).

export type MapNodeKind = "index" | "sector" | "stock" | "macro";

export interface MapUniverseEntry {
  ticker: string;
  /** Plain-English label a beginner would say out loud (CLAUDE.md). */
  label: string;
  kind: MapNodeKind;
}

export const MAP_UNIVERSE: MapUniverseEntry[] = [
  // Anchors — the market itself, pinned at the center.
  { ticker: "SPY", label: "S&P 500", kind: "index" },
  { ticker: "QQQ", label: "Nasdaq 100", kind: "index" },
  { ticker: "IWM", label: "Small caps", kind: "index" },

  // The 11 GICS sector SPDRs — "where capital is rotating."
  { ticker: "XLK",  label: "Technology",      kind: "sector" },
  { ticker: "XLF",  label: "Financials",      kind: "sector" },
  { ticker: "XLE",  label: "Energy",          kind: "sector" },
  { ticker: "XLV",  label: "Health Care",     kind: "sector" },
  { ticker: "XLY",  label: "Consumer Disc.",  kind: "sector" },
  { ticker: "XLP",  label: "Cons. Staples",   kind: "sector" },
  { ticker: "XLI",  label: "Industrials",     kind: "sector" },
  { ticker: "XLU",  label: "Utilities",       kind: "sector" },
  { ticker: "XLB",  label: "Materials",       kind: "sector" },
  { ticker: "XLRE", label: "Real Estate",     kind: "sector" },
  { ticker: "XLC",  label: "Comm. Services",  kind: "sector" },

  // Macro ETF proxies — cross-market forces, outer ring.
  { ticker: "GLD",  label: "Gold",             kind: "macro" },
  { ticker: "TLT",  label: "Bonds (20Y)",      kind: "macro" },
  { ticker: "UUP",  label: "US Dollar",        kind: "macro" },
  { ticker: "USO",  label: "Oil",              kind: "macro" },
  { ticker: "VXX",  label: "Volatility (VIX)", kind: "macro" },

  // ── Technology (XLK) ─────────────────────────────────────────────────────
  { ticker: "AAPL",  label: "Apple",      kind: "stock" },
  { ticker: "MSFT",  label: "Microsoft",  kind: "stock" },
  { ticker: "NVDA",  label: "Nvidia",     kind: "stock" },
  { ticker: "AMD",   label: "AMD",        kind: "stock" },
  { ticker: "AVGO",  label: "Broadcom",   kind: "stock" },
  { ticker: "CRM",   label: "Salesforce", kind: "stock" },
  { ticker: "ADBE",  label: "Adobe",      kind: "stock" },
  { ticker: "ORCL",  label: "Oracle",     kind: "stock" },

  // ── Financials (XLF) ─────────────────────────────────────────────────────
  { ticker: "JPM",  label: "JPMorgan",        kind: "stock" },
  { ticker: "BAC",  label: "Bank of America", kind: "stock" },
  { ticker: "GS",   label: "Goldman Sachs",   kind: "stock" },
  { ticker: "MS",   label: "Morgan Stanley",  kind: "stock" },
  { ticker: "V",    label: "Visa",            kind: "stock" },
  { ticker: "MA",   label: "Mastercard",      kind: "stock" },
  { ticker: "BLK",  label: "BlackRock",       kind: "stock" },

  // ── Energy (XLE) ─────────────────────────────────────────────────────────
  { ticker: "XOM",  label: "ExxonMobil",     kind: "stock" },
  { ticker: "CVX",  label: "Chevron",        kind: "stock" },
  { ticker: "COP",  label: "ConocoPhillips", kind: "stock" },
  { ticker: "SLB",  label: "SLB",            kind: "stock" },
  { ticker: "EOG",  label: "EOG Resources",  kind: "stock" },

  // ── Health Care (XLV) ────────────────────────────────────────────────────
  { ticker: "JNJ",  label: "J&J",         kind: "stock" },
  { ticker: "UNH",  label: "UnitedHealth", kind: "stock" },
  { ticker: "LLY",  label: "Eli Lilly",   kind: "stock" },
  { ticker: "ABBV", label: "AbbVie",      kind: "stock" },
  { ticker: "PFE",  label: "Pfizer",      kind: "stock" },

  // ── Consumer Discretionary (XLY) ─────────────────────────────────────────
  { ticker: "AMZN", label: "Amazon",     kind: "stock" },
  { ticker: "TSLA", label: "Tesla",      kind: "stock" },
  { ticker: "HD",   label: "Home Depot", kind: "stock" },
  { ticker: "MCD",  label: "McDonald's", kind: "stock" },
  { ticker: "NKE",  label: "Nike",       kind: "stock" },

  // ── Consumer Staples (XLP) ───────────────────────────────────────────────
  { ticker: "WMT",  label: "Walmart",   kind: "stock" },
  { ticker: "PG",   label: "P&G",       kind: "stock" },
  { ticker: "KO",   label: "Coca-Cola", kind: "stock" },
  { ticker: "COST", label: "Costco",    kind: "stock" },

  // ── Industrials (XLI) ────────────────────────────────────────────────────
  { ticker: "CAT",  label: "Caterpillar", kind: "stock" },
  { ticker: "BA",   label: "Boeing",      kind: "stock" },
  { ticker: "HON",  label: "Honeywell",   kind: "stock" },
  { ticker: "DE",   label: "Deere",       kind: "stock" },

  // ── Communication Services (XLC) ─────────────────────────────────────────
  { ticker: "GOOGL", label: "Alphabet", kind: "stock" },
  { ticker: "META",  label: "Meta",     kind: "stock" },
  { ticker: "NFLX",  label: "Netflix",  kind: "stock" },
  { ticker: "DIS",   label: "Disney",   kind: "stock" },

  // ── Materials (XLB) ──────────────────────────────────────────────────────
  { ticker: "LIN",  label: "Linde",           kind: "stock" },
  { ticker: "FCX",  label: "Freeport-McMoRan", kind: "stock" },
  { ticker: "NEM",  label: "Newmont",          kind: "stock" },

  // ── Utilities (XLU) ──────────────────────────────────────────────────────
  { ticker: "NEE",  label: "NextEra Energy", kind: "stock" },
  { ticker: "DUK",  label: "Duke Energy",    kind: "stock" },

  // ── Real Estate (XLRE) ───────────────────────────────────────────────────
  { ticker: "AMT",  label: "American Tower", kind: "stock" },
  { ticker: "PLD",  label: "Prologis",       kind: "stock" },
];

/** stock ticker → parent sector ETF ticker. Drives membership edges + spring clustering. */
export const MAP_STOCK_PARENT: Record<string, string> = {
  AAPL: "XLK", MSFT: "XLK", NVDA: "XLK", AMD:  "XLK",
  AVGO: "XLK", CRM:  "XLK", ADBE: "XLK", ORCL: "XLK",
  JPM:  "XLF", BAC:  "XLF", GS:   "XLF", MS:   "XLF",
  V:    "XLF", MA:   "XLF", BLK:  "XLF",
  XOM:  "XLE", CVX:  "XLE", COP:  "XLE", SLB:  "XLE", EOG: "XLE",
  JNJ:  "XLV", UNH:  "XLV", LLY:  "XLV", ABBV: "XLV", PFE: "XLV",
  AMZN: "XLY", TSLA: "XLY", HD:   "XLY", MCD:  "XLY", NKE: "XLY",
  WMT:  "XLP", PG:   "XLP", KO:   "XLP", COST: "XLP",
  CAT:  "XLI", BA:   "XLI", HON:  "XLI", DE:   "XLI",
  GOOGL:"XLC", META: "XLC", NFLX: "XLC", DIS:  "XLC",
  LIN:  "XLB", FCX:  "XLB", NEM:  "XLB",
  NEE:  "XLU", DUK:  "XLU",
  AMT:  "XLRE", PLD: "XLRE",
};

export const MAP_INDEX_IDS = MAP_UNIVERSE.filter((e) => e.kind === "index").map((e) => e.ticker);

/** Horizon that drives node tone + leaders/laggards ranking. */
export type MapHorizon = "1w" | "1m" | "3m";

/** Up / down / flat — paired with arrows/dots in the UI so meaning never relies on
 *  hue alone (CLAUDE.md). Maps to --up / --down / --text-muted. */
export type MomentumTone = "up" | "down" | "neutral";

// ── Graph ────────────────────────────────────────────────────────────────────

export interface MapNode {
  id: string;
  label: string;
  ticker: string;
  kind: MapNodeKind;
  ret1wPct: number | null;
  ret1mPct: number | null;
  ret3mPct: number | null;
  tone: MomentumTone;
  /** 0..1 relevance from |horizon return|, clamped → node radius. */
  weight: number;
  freshnessLabel: string | null;
  sourceUrl: string | null;
}

export type MapEdgeKind = "correlation" | "membership";

export interface MapEdge {
  source: string;
  target: string;
  /** 0..1 strength → line thickness/opacity. */
  weight: number;
  kind: MapEdgeKind;
}

// ── Rotation (leaders / laggards) ────────────────────────────────────────────

export interface RotationEntry {
  id: string;
  ticker: string;
  label: string;
  ret1wPct: number | null;
  ret1mPct: number | null;
  ret3mPct: number | null;
}

// ── Deterministic core (engine output — sectors.ts). No AI, always renders. ──

export interface MarketMapData {
  nodes: MapNode[];
  edges: MapEdge[];
  leaders: RotationEntry[];
  laggards: RotationEntry[];
  horizon: MapHorizon;
  asOf: string;
  freshnessLabel: string;
  unpriced: string[];
}

// ── Narrative (generate.ts — one MODELS.lens call). Orientation, never alpha. ─

export interface MarketMapNarrative {
  headline: string;
  story: string;
  leadersNote: string;
  laggardsNote: string;
  watch: string[];
}

// ── Cached payload (feed_cache key "feed:map") ───────────────────────────────

export interface MarketMap {
  data: MarketMapData;
  narrative: MarketMapNarrative | null;
  generatedAt: string;
}

// ── Helpers (client-safe) ─────────────────────────────────────────────────────

export function toneFromPct(pct: number | null): MomentumTone {
  if (pct == null || Math.abs(pct) < 0.1) return "neutral";
  return pct > 0 ? "up" : "down";
}

export function retForHorizon(
  n: { ret1wPct: number | null; ret1mPct: number | null; ret3mPct: number | null },
  h: MapHorizon
): number | null {
  return h === "1w" ? n.ret1wPct : h === "3m" ? n.ret3mPct : n.ret1mPct;
}

export function weightFromRet(pct: number | null, capPct = 12): number {
  if (pct == null) return 0.1;
  return Math.min(1, Math.abs(pct) / capPct);
}
