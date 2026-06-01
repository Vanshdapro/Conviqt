// Deterministic portfolio metrics. NO model involvement — every number here
// is exact arithmetic over the user's share counts and the sweep's sourced
// prices. This is the citation backbone of the audit: weights and
// concentration figures inherit the provenance of the prices they're built
// from, so the risk agents reason over hard numbers, not guesses.

import type {
  Holding,
  HoldingFacts,
  PortfolioFactSheet,
  PortfolioMetrics,
  PositionMetric,
  SectorWeight,
} from "./types";

function factsByTicker(fs: PortfolioFactSheet): Map<string, HoldingFacts> {
  const map = new Map<string, HoldingFacts>();
  for (const h of fs.holdings) map.set(h.ticker.toUpperCase(), h);
  return map;
}

export function computeMetrics(
  holdings: Holding[],
  factSheet: PortfolioFactSheet
): PortfolioMetrics {
  const facts = factsByTicker(factSheet);

  // 1. Build raw positions. A position is "priced" only if the sweep returned
  //    a numeric price for it; unpriced names are excluded from weight math
  //    (and flagged) rather than guessed at.
  const raw: PositionMetric[] = holdings.map((h) => {
    const t = h.ticker.toUpperCase();
    const f = facts.get(t);
    const priceNum = f?.priceNum ?? null;
    const priced = priceNum !== null && priceNum > 0 && h.shares > 0;
    const value = priced ? priceNum! * h.shares : 0;
    return {
      ticker: t,
      companyName: f?.companyName ?? t,
      sector: f?.sector ?? "Unknown",
      shares: h.shares,
      price: f?.price ?? "—",
      value,
      weightPct: 0, // filled below once we know the total
      priced,
    };
  });

  const pricedValue = raw.reduce((s, p) => s + p.value, 0);
  const totalValue = pricedValue; // unpriced contribute 0 — we weight over what we can price

  for (const p of raw) {
    p.weightPct = totalValue > 0 && p.priced ? (p.value / totalValue) * 100 : 0;
  }

  const positions = [...raw].sort((a, b) => b.weightPct - a.weightPct);

  // 2. Sector weights — aggregate priced weight by sector label.
  const sectorMap = new Map<string, { weightPct: number; tickers: string[] }>();
  for (const p of positions) {
    if (!p.priced) continue;
    const key = p.sector || "Unknown";
    const entry = sectorMap.get(key) ?? { weightPct: 0, tickers: [] };
    entry.weightPct += p.weightPct;
    entry.tickers.push(p.ticker);
    sectorMap.set(key, entry);
  }
  const sectors: SectorWeight[] = Array.from(sectorMap.entries())
    .map(([sector, v]) => ({ sector, weightPct: v.weightPct, tickers: v.tickers }))
    .sort((a, b) => b.weightPct - a.weightPct);

  // 3. Concentration figures.
  const topPositionPct = positions[0]?.weightPct ?? 0;
  const top5Pct = positions.slice(0, 5).reduce((s, p) => s + p.weightPct, 0);
  const topSectorPct = sectors[0]?.weightPct ?? 0;

  // Herfindahl-Hirschman Index over position weights (in %, so 0-10000).
  // A perfectly equal-weight 10-stock book ≈ 1000; a single position ≈ 10000.
  const hhi = positions.reduce((s, p) => s + p.weightPct * p.weightPct, 0);

  const unpricedCount = positions.filter((p) => !p.priced).length;

  return {
    totalValue,
    pricedValue,
    positions,
    sectors,
    topPositionPct: round1(topPositionPct),
    top5Pct: round1(top5Pct),
    topSectorPct: round1(topSectorPct),
    hhi: Math.round(hhi),
    positionCount: positions.length,
    unpricedCount,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Compact human-readable digest of the metrics, fed to the risk agents and
// the judge so they reason over the exact same numbers the UI renders.
export function renderMetricsBrief(m: PortfolioMetrics): string {
  const lines: string[] = [];
  lines.push(
    `Total priced value: $${m.pricedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${m.positionCount} positions${m.unpricedCount > 0 ? ` (${m.unpricedCount} could not be priced and are excluded)` : ""}.`
  );
  lines.push(
    `Concentration: largest position ${m.topPositionPct}%, top-5 ${m.top5Pct}%, largest sector ${m.topSectorPct}%, HHI ${m.hhi}.`
  );
  lines.push("");
  lines.push("POSITIONS (by weight):");
  for (const p of m.positions) {
    if (!p.priced) {
      lines.push(`- ${p.ticker} (${p.companyName}) — ${p.sector} — UNPRICED, excluded from weights`);
      continue;
    }
    lines.push(
      `- ${p.ticker} (${p.companyName}) — ${p.sector} — ${p.weightPct.toFixed(1)}% (${p.shares} sh @ ${p.price})`
    );
  }
  lines.push("");
  lines.push("SECTOR WEIGHTS:");
  for (const s of m.sectors) {
    lines.push(`- ${s.sector}: ${s.weightPct.toFixed(1)}% (${s.tickers.join(", ")})`);
  }
  return lines.join("\n");
}
