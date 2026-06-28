// The Map — deterministic engine. NO AI lives here.
//
// Turns raw price history into a market node-graph + rotation table: the
// "always renders" half of the Lens trilogy (the narrative is a separate, optional
// DeepSeek call in generate.ts). Given the MAP_UNIVERSE proxies, this computes
// per-node momentum (1w/1m/3m returns), co-movement edges between sectors
// (Pearson correlation of daily returns), and the leaders/laggards rotation.
//
// Honesty guardrails (CLAUDE.md): every number traces to the marketdata layer —
// freshnessLabel + sourceUrl ride along on each node. A ticker we can't price
// goes in `unpriced` and is rendered as such; we NEVER guess a price. Orientation,
// never alpha: this is "where capital rotated," not "buy energy."
//
// Server-only: pulls src/lib/marketdata.history. Pure + synchronous math past the
// fetch — deterministic for the same candles in, so it caches cleanly in store.ts.

import { history } from "@/lib/marketdata";
import type { Candle, PriceHistory } from "@/lib/marketdata";
import {
  MAP_UNIVERSE,
  MAP_STOCK_PARENT,
  toneFromPct,
  retForHorizon,
  weightFromRet,
} from "./types";
import type {
  MapEdge,
  MapNode,
  MomentumTone,
  MarketMapData,
  MapHorizon,
  RotationEntry,
} from "./types";

// Approximate trading sessions per horizon — mirrors lens/generate.ts so both
// halves of the trilogy measure the same windows.
const SESSIONS_1W = 5;
const SESSIONS_1M = 21;
const SESSIONS_3M = 63;

// Edge tuning
const CORR_MIN = 0.55; // below this, correlation is noise; drop it
const MAX_EDGES_PER_NODE = 5; // correlation fan-out cap (membership edges bypass this)
const DEFAULT_HORIZON: MapHorizon = "1m";
const FETCH_CONCURRENCY = 4; // free feeds 429 a 14-way burst; pull a few at a time

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Map over items with a fixed worker pool — preserves input order, never
// throws (the mapper itself swallows fetch errors). Keeps free-feed bursts
// small so they don't trip rate limits.
async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// Close `n` sessions before the latest candle (clamped to available history).
// null when there aren't enough candles to look back that far — that horizon
// return then renders as "n/a" rather than a faked number (lens parity).
function closeNAgo(candles: Candle[], n: number): number | null {
  if (candles.length < n + 1) return null;
  const idx = candles.length - 1 - n;
  const c = candles[idx]?.close;
  return c && c > 0 ? c : null;
}
function pctFrom(latest: number, past: number | null): number | null {
  return past && past > 0 ? round2((latest / past - 1) * 100) : null;
}

// Daily simple returns from close-to-close, length = candles.length - 1.
// Used only for correlation, so we keep it raw (no rounding — rounding here
// would bias Pearson on tightly-coupled sectors).
function dailyReturns(candles: Candle[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]?.close;
    const cur = candles[i]?.close;
    if (prev && prev > 0 && cur && cur > 0) out.push(cur / prev - 1);
    else out.push(0); // a bad candle shouldn't desync the two series we zip later
  }
  return out;
}

// Pearson correlation over the overlapping tail of two daily-return series.
// Numerically safe: zero variance (a flat series) → 0, never NaN, so a stale
// proxy can't poison the graph with phantom edges.
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  // Align on the most recent `n` sessions (series can differ in length).
  const xs = a.slice(a.length - n);
  const ys = b.slice(b.length - n);

  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;

  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx <= 0 || vy <= 0) return 0; // flat series → undefined correlation → 0
  const r = cov / Math.sqrt(vx * vy);
  return Number.isFinite(r) ? r : 0;
}

// A priced universe entry: the proxy + its history, carried so node-building
// and correlation math both read from one place.
interface Priced {
  ticker: string;
  label: string;
  kind: MapNode["kind"];
  candles: Candle[];
  ret1wPct: number | null;
  ret1mPct: number | null;
  ret3mPct: number | null;
  dailyRets: number[];
  freshnessLabel: string;
  sourceUrl: string;
}

export async function computeMarketMap(opts?: {
  horizon?: MapHorizon;
}): Promise<MarketMapData> {
  const horizon = opts?.horizon ?? DEFAULT_HORIZON;

  // 1. Only fetch price history for index + sector nodes (the 14 original data
  // nodes). Stock and macro nodes are PURELY structural/topological — they exist
  // in the graph for visual density but don't need live price data. This avoids
  // sending 68 requests to the free feeds which would trigger rate-limiting and
  // leave the important sector performance data empty.
  const dataUniverse = MAP_UNIVERSE.filter(
    (e) => e.kind === "index" || e.kind === "sector"
  );
  const topologyUniverse = MAP_UNIVERSE.filter(
    (e) => e.kind === "stock" || e.kind === "macro"
  );

  const fetched = await mapWithLimit(dataUniverse, FETCH_CONCURRENCY, async (e) => {
    try {
      const hist = await history(e.ticker, "3mo");
      return { entry: e, hist } as { entry: typeof e; hist: PriceHistory | null };
    } catch {
      return { entry: e, hist: null as PriceHistory | null };
    }
  });

  const priced: Priced[] = [];
  const unpriced: string[] = [];

  for (const { entry, hist } of fetched) {
    const candles = hist?.candles ?? [];
    if (!hist || candles.length < 2) {
      unpriced.push(entry.ticker);
      continue;
    }
    const latest = candles[candles.length - 1]?.close;
    if (!latest || latest <= 0) {
      unpriced.push(entry.ticker);
      continue;
    }

    priced.push({
      ticker: entry.ticker,
      label: entry.label,
      kind: entry.kind,
      candles,
      ret1wPct: pctFrom(latest, closeNAgo(candles, SESSIONS_1W)),
      ret1mPct: pctFrom(latest, closeNAgo(candles, SESSIONS_1M)),
      ret3mPct: pctFrom(latest, closeNAgo(candles, SESSIONS_3M)),
      dailyRets: dailyReturns(candles),
      freshnessLabel: hist.freshnessLabel,
      sourceUrl: hist.sourceUrl,
    });
  }

  // Structural-only nodes for stock + macro entries (topology without price data).
  // Rendered as neutral dots in the graph; hover tooltip shows "—" for returns.
  const structuralNodes: MapNode[] = topologyUniverse.map((entry) => ({
    id: entry.ticker,
    label: entry.label,
    ticker: entry.ticker,
    kind: entry.kind,
    ret1wPct: null,
    ret1mPct: null,
    ret3mPct: null,
    tone: "neutral" as MomentumTone,
    weight: 0.15,
    freshnessLabel: null,
    sourceUrl: null,
  }));

  // 3. Nodes — tone + weight keyed off the active horizon.
  const pricedNodes: MapNode[] = priced.map((p) => {
    const hr = retForHorizon(p, horizon);
    return {
      id: p.ticker,
      label: p.label,
      ticker: p.ticker,
      kind: p.kind,
      ret1wPct: p.ret1wPct,
      ret1mPct: p.ret1mPct,
      ret3mPct: p.ret3mPct,
      tone: toneFromPct(hr),
      weight: weightFromRet(hr),
      freshnessLabel: p.freshnessLabel,
      sourceUrl: p.sourceUrl,
    };
  });

  // All nodes: priced first so they render over structural ones when coincident.
  const nodes: MapNode[] = [...pricedNodes, ...structuralNodes];
  const allNodeIds = new Set(nodes.map((n) => n.id));

  // 4a. Membership edges — stock → parent sector (structural, bypasses cap).
  // Every stock node gets exactly one membership edge regardless of price data.
  const membershipEdges: MapEdge[] = [];
  for (const n of nodes) {
    if (n.kind !== "stock") continue;
    const parentTicker = MAP_STOCK_PARENT[n.ticker];
    if (!parentTicker || !allNodeIds.has(parentTicker)) continue;
    const [src, tgt] = n.ticker < parentTicker ? [n.ticker, parentTicker] : [parentTicker, n.ticker];
    membershipEdges.push({ source: src, target: tgt, weight: 0.8, kind: "membership" });
  }

  // 4b. Correlation edges — priced sectors only. Undirected, deduped source<target.
  const sectors = priced.filter((p) => p.kind === "sector");
  const candidates: MapEdge[] = [];
  for (let i = 0; i < sectors.length; i++) {
    for (let j = i + 1; j < sectors.length; j++) {
      const a = sectors[i];
      const b = sectors[j];
      const r = pearson(a.dailyRets, b.dailyRets);
      const w = Math.abs(r);
      if (w < CORR_MIN) continue;
      const [source, target] = a.ticker < b.ticker ? [a.ticker, b.ticker] : [b.ticker, a.ticker];
      candidates.push({ source, target, weight: Math.min(1, Math.max(0, w)), kind: "correlation" });
    }
  }
  const corrEdges = capEdgesPerNode(candidates, MAX_EDGES_PER_NODE);

  const edges = [...membershipEdges, ...corrEdges];

  // 5. Rotation — sectors only, ranked by the horizon return; skip nulls.
  const rankable = sectors
    .map((p): { entry: RotationEntry; hr: number } | null => {
      const hr = retForHorizon(p, horizon);
      if (hr == null) return null;
      return {
        entry: {
          id: p.ticker,
          ticker: p.ticker,
          label: p.label,
          ret1wPct: p.ret1wPct,
          ret1mPct: p.ret1mPct,
          ret3mPct: p.ret3mPct,
        },
        hr,
      };
    })
    .filter((x): x is { entry: RotationEntry; hr: number } => x !== null);

  // Disjoint by rank: a sector can never appear as BOTH leading and lagging.
  // With few sectors priced, top-4/bottom-4 would otherwise mirror the same
  // names — so cap each side at floor(n/2) (and ≤4). Sorted best→worst, take
  // the top k as leaders and the bottom k as laggards from opposite ends.
  const byRet = [...rankable].sort((a, b) => b.hr - a.hr);
  const k = Math.min(4, Math.floor(byRet.length / 2));
  const leaders = byRet.slice(0, k).map((x) => x.entry);
  const laggards = byRet.slice(byRet.length - k).reverse().map((x) => x.entry);

  // 6. Freshness — the most common non-empty label across priced histories.
  const freshnessLabel = dominantLabel(priced.map((p) => p.freshnessLabel));

  return {
    nodes,
    edges,
    leaders,
    laggards,
    horizon,
    asOf: new Date().toISOString(),
    freshnessLabel,
    unpriced,
  };
}

// Keep, for each node, only its strongest `max` edges — but an edge stays in the
// graph only if it makes the cut from BOTH endpoints' perspective. Strongest-first
// so the densest sectors shed their weakest links, not their backbone.
function capEdgesPerNode(candidates: MapEdge[], max: number): MapEdge[] {
  const byStrength = [...candidates].sort((a, b) => b.weight - a.weight);
  const kept = new Map<string, number>(); // node id → edges kept so far
  const out: MapEdge[] = [];
  for (const e of byStrength) {
    const sc = kept.get(e.source) ?? 0;
    const tc = kept.get(e.target) ?? 0;
    if (sc >= max || tc >= max) continue;
    out.push(e);
    kept.set(e.source, sc + 1);
    kept.set(e.target, tc + 1);
  }
  return out;
}

// Most frequent non-empty string; ties broken by first-seen. Fallback keeps the
// honesty trace non-empty even if every provider somehow omitted a label.
function dominantLabel(labels: string[]): string {
  const counts = new Map<string, number>();
  for (const l of labels) {
    if (!l) continue;
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [label, n] of counts) {
    if (n > bestN) {
      best = label;
      bestN = n;
    }
  }
  return best || "end-of-day data";
}
