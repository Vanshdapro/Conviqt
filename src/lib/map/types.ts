// The Map — shared type contract for the Dashboard market map (the Lens trilogy).
//
// "What the market is doing, and where the money is moving." A 2D node-graph of
// the market: index + sector + theme nodes, sized by momentum, linked by
// co-movement, with a plain-English narrative. Orientation, never alpha
// (CLAUDE.md honesty guardrail): the map says "capital rotated INTO energy this
// month, here's the story" — never "buy energy."
//
// Client-safe: pure data + tiny helpers, no server imports. The deterministic
// engine lives in sectors.ts (server: marketdata.history), the narrative in
// generate.ts (server: MODELS.lens), persistence in store.ts (feed_cache).
//
// Layering (so every consumer knows what is real vs. AI):
//   MarketMapData      ← deterministic, from price history only. Always renders.
//   MarketMapNarrative ← one DeepSeek call over the deterministic table. Optional.
//   MarketMap          ← { data, narrative } — the cached payload.

// ── Universe (client-safe, single source of truth) ───────────────────────────
//
// Liquid ETF proxies — the free feeds quote ETFs far more reliably than ^index
// symbols (same reasoning as feed/types.ts SNAPSHOT_TICKERS). Indices anchor the
// center of the graph; the 11 GICS sector SPDRs are the orbiting nodes.

export type MapNodeKind = "index" | "sector" | "theme";

export interface MapUniverseEntry {
  ticker: string;
  /** Plain-English label a beginner would say out loud (CLAUDE.md). */
  label: string;
  kind: MapNodeKind;
}

export const MAP_UNIVERSE: MapUniverseEntry[] = [
  // Anchors — the market itself, center of the graph.
  { ticker: "SPY", label: "S&P 500", kind: "index" },
  { ticker: "QQQ", label: "Nasdaq 100", kind: "index" },
  { ticker: "IWM", label: "Small caps", kind: "index" },
  // The 11 sector SPDRs — "where capital is rotating."
  { ticker: "XLK", label: "Technology", kind: "sector" },
  { ticker: "XLF", label: "Financials", kind: "sector" },
  { ticker: "XLE", label: "Energy", kind: "sector" },
  { ticker: "XLV", label: "Health Care", kind: "sector" },
  { ticker: "XLY", label: "Consumer Discretionary", kind: "sector" },
  { ticker: "XLP", label: "Consumer Staples", kind: "sector" },
  { ticker: "XLI", label: "Industrials", kind: "sector" },
  { ticker: "XLU", label: "Utilities", kind: "sector" },
  { ticker: "XLB", label: "Materials", kind: "sector" },
  { ticker: "XLRE", label: "Real Estate", kind: "sector" },
  { ticker: "XLC", label: "Communication Services", kind: "sector" },
];

export const MAP_INDEX_IDS = MAP_UNIVERSE.filter((e) => e.kind === "index").map((e) => e.ticker);

/** Horizon that drives node tone + leaders/laggards ranking. */
export type MapHorizon = "1w" | "1m" | "3m";

/** Up / down / flat — paired with arrows in the UI so meaning never relies on
 *  hue alone (CLAUDE.md). Maps to --up / --down / --text-muted. */
export type MomentumTone = "up" | "down" | "neutral";

// ── Graph ────────────────────────────────────────────────────────────────────

export interface MapNode {
  /** Stable id — equals the proxy ticker, e.g. "XLK". */
  id: string;
  label: string;
  ticker: string;
  kind: MapNodeKind;
  /** Percent returns (e.g. -1.42). null when history was unavailable. */
  ret1wPct: number | null;
  ret1mPct: number | null;
  ret3mPct: number | null;
  /** Sign of the horizon return → arrow + color. */
  tone: MomentumTone;
  /** 0..1 relevance from |horizon return|, clamped → node radius. */
  weight: number;
  /** Honesty trace — every rendered number is sourced (CLAUDE.md). */
  freshnessLabel: string | null;
  sourceUrl: string | null;
}

export type MapEdgeKind = "correlation";

export interface MapEdge {
  /** MapNode.id */
  source: string;
  /** MapNode.id */
  target: string;
  /** 0..1 strength → line thickness/opacity. Magnitude of return correlation. */
  weight: number;
  kind: MapEdgeKind;
}

// ── Rotation (leaders / laggards) ────────────────────────────────────────────

export interface RotationEntry {
  /** MapNode.id */
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
  /** Sorted best→worst over `horizon` (sectors only; indices are anchors). */
  leaders: RotationEntry[];
  laggards: RotationEntry[];
  horizon: MapHorizon;
  /** ISO timestamp of the compute. */
  asOf: string;
  /** Dominant data freshness across the universe, e.g. "end-of-day data". */
  freshnessLabel: string;
  /** Tickers we could not price this run (rendered honestly, never faked). */
  unpriced: string[];
}

// ── Narrative (generate.ts — one MODELS.lens call). Orientation, never alpha. ─

export interface MarketMapNarrative {
  /** One line: what the market is doing right now. Plain English, no jargon. */
  headline: string;
  /** 2–4 sentences: where capital rotated this period and the story behind it. */
  story: string;
  /** One line on what's leading + the honest why (no "buy"). */
  leadersNote: string;
  /** One line on what's lagging. */
  laggardsNote: string;
  /** 2–3 forward "what to watch" lines — framing, NOT predictions. */
  watch: string[];
}

// ── Cached payload (feed_cache key "feed:map") ───────────────────────────────

export interface MarketMap {
  data: MarketMapData;
  /** null = the narrative call failed; the deterministic map still renders. */
  narrative: MarketMapNarrative | null;
  /** ISO. */
  generatedAt: string;
}

// ── Helpers (client-safe) ─────────────────────────────────────────────────────

/** Sign of a percent return → tone. ~0 (|x| < 0.1%) reads neutral. */
export function toneFromPct(pct: number | null): MomentumTone {
  if (pct == null || Math.abs(pct) < 0.1) return "neutral";
  return pct > 0 ? "up" : "down";
}

/** Pick the horizon return off a node/entry. */
export function retForHorizon(
  n: { ret1wPct: number | null; ret1mPct: number | null; ret3mPct: number | null },
  h: MapHorizon
): number | null {
  return h === "1w" ? n.ret1wPct : h === "3m" ? n.ret3mPct : n.ret1mPct;
}

/** |horizon return| → 0..1 node weight. Caps at ±12% so one outlier can't
 *  swallow the graph; tune in one place. */
export function weightFromRet(pct: number | null, capPct = 12): number {
  if (pct == null) return 0.12; // priced-but-flat still gets a small presence
  return Math.min(1, Math.abs(pct) / capPct);
}
