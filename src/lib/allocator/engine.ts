// The deterministic core of the Allocator. NO model involvement — every number
// here is exact arithmetic over the user's stated capacity and a rules engine
// that encodes The Financial View's framework (debt-first, emergency-fund gate,
// horizon+risk equity glide, the 5% cash rule, capacity-gated satellites).
//
// This is the citation-free backbone: allocation percentages and dollar splits
// are derived from the user's own inputs, so they carry no provenance burden.
// The specialists and judge then attach SOURCED vehicle facts (prices, yields,
// expense ratios) on top of this skeleton.

import type {
  AssetClass,
  Baseline,
  BaselineSleeve,
  CandidateVehicle,
  Goal,
  Guardrail,
  HorizonBucket,
  InvestorProfile,
  Prerequisite,
} from "./types";

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function bucketFor(years: number): HorizonBucket {
  if (years < 3) return "short";
  if (years < 7) return "medium";
  if (years < 15) return "long";
  return "veryLong";
}

// Capacity tier purely controls COMPLEXITY (how many satellites / sleeves we
// allow), never the equity/bond mix. A small starter account stays in pure
// index funds; a larger one can carry single-stock and sector satellites.
function capacityTierFor(annualDeploy: number): 1 | 2 | 3 | 4 {
  if (annualDeploy < 6_000) return 1;
  if (annualDeploy < 25_000) return 2;
  if (annualDeploy < 75_000) return 3;
  return 4;
}

// Base equity weight from the time horizon — the single biggest driver. The
// longer the money can stay invested, the more it belongs in equities.
function baseEquityForBucket(b: HorizonBucket): number {
  switch (b) {
    case "short":
      return 25;
    case "medium":
      return 55;
    case "long":
      return 80;
    case "veryLong":
      return 90;
  }
}

function riskEquityDelta(r: InvestorProfile["riskTolerance"]): number {
  switch (r) {
    case "conservative":
      return -18;
    case "balanced":
      return 0;
    case "growth":
      return 8;
    case "aggressive":
      return 16;
  }
}

function has(guardrails: Guardrail[], g: Guardrail): boolean {
  return guardrails.includes(g);
}

// Build the debt-first / emergency-fund prerequisites from the guide. These
// don't block the plan from rendering, but a blocking one is surfaced loudly
// and trims how aggressively we deploy.
function buildPrerequisites(profile: InvestorProfile): Prerequisite[] {
  const out: Prerequisite[] = [];
  if (profile.highInterestDebt) {
    out.push({
      kind: "debt",
      title: "Clear high-interest debt before investing around it",
      detail:
        "You flagged debt above ~7% APR. Paying it off is a guaranteed return equal to its rate — higher than the ~7-10% the market averages, and without the risk. Direct spare cash here first; the allocation below is for capital beyond that.",
      blocking: true,
    });
  }
  if (!profile.hasEmergencyFund) {
    out.push({
      kind: "emergency_fund",
      title: "Build a 3-6 month emergency fund first",
      detail:
        "Without a cash buffer in a high-yield savings account, real-life shocks force you to sell investments at the worst time. Fund 3 months minimum (6 if your income is variable) before pushing into equities. This is separate from the 5% cash buffer inside the portfolio below.",
      blocking: true,
    });
  }
  return out;
}

// The candidate vehicle universe the sweep will price/quote. Kept deterministic
// and tight (≈6-9 names) so the sweep stays cheap and focused.
function buildUniverse(
  profile: InvestorProfile,
  bucket: HorizonBucket,
  tier: 1 | 2 | 3 | 4,
  sleeves: BaselineSleeve[]
): CandidateVehicle[] {
  const g = profile.guardrails;
  const active = new Set(sleeves.filter((s) => s.targetPct > 0).map((s) => s.assetClass));
  const u: CandidateVehicle[] = [];

  // Core US equity — always present if there's any equity.
  if (active.has("Core US Equity")) {
    if (has(g, "esgTilt")) {
      u.push({ ticker: "ESGV", name: "Vanguard ESG US Stock ETF", assetClass: "Core US Equity", kind: "etf", wants: ["price", "expenseRatio"] });
    } else {
      u.push({ ticker: "VTI", name: "Vanguard Total US Market ETF", assetClass: "Core US Equity", kind: "etf", wants: ["price", "expenseRatio"] });
    }
  }
  if (active.has("International Equity")) {
    u.push({ ticker: "VXUS", name: "Vanguard Total International Stock ETF", assetClass: "International Equity", kind: "etf", wants: ["price", "expenseRatio"] });
  }
  if (active.has("Dividend / Income")) {
    u.push({ ticker: "SCHD", name: "Schwab US Dividend Equity ETF", assetClass: "Dividend / Income", kind: "etf", wants: ["price", "expenseRatio", "yield"] });
  }
  if (active.has("Bonds")) {
    u.push({ ticker: "BND", name: "Vanguard Total Bond Market ETF", assetClass: "Bonds", kind: "etf", wants: ["price", "expenseRatio", "yield"] });
  }
  if (active.has("Satellite / Single Stocks")) {
    // Satellites only enabled for larger, higher-risk books and never under
    // an index-only guardrail. We seed a sector ETF as the sourced anchor;
    // the judge can suggest individual names with the five-question caveat.
    u.push({ ticker: "XLK", name: "Technology Select Sector SPDR", assetClass: "Satellite / Single Stocks", kind: "etf", wants: ["price", "expenseRatio"] });
  }
  if (active.has("Inflation Hedge")) {
    u.push({ ticker: "GLDM", name: "SPDR Gold MiniShares", assetClass: "Inflation Hedge", kind: "etf", wants: ["price", "expenseRatio"] });
    u.push({ ticker: "IBOND", name: "US Series I Savings Bond (TreasuryDirect)", assetClass: "Inflation Hedge", kind: "bond", wants: ["yield"] });
  }
  // Cash buffer — money-market yield is always worth sourcing (the 5% rule).
  u.push({ ticker: "VMFXX", name: "Vanguard Federal Money Market Fund", assetClass: "Cash Buffer", kind: "fund", wants: ["yield"] });
  // If the emergency fund isn't built, HYSA rate is decision-relevant too.
  if (!profile.hasEmergencyFund || bucket === "short") {
    u.push({ ticker: "HYSA", name: "High-Yield Savings Account (Marcus/Ally/SoFi)", assetClass: "Cash Buffer", kind: "savings", wants: ["yield"] });
  }
  void tier;
  return u;
}

export function computeBaseline(profile: InvestorProfile): Baseline {
  const bucket = bucketFor(profile.horizonYears);
  const g = profile.guardrails;

  const lumpSum = Math.max(0, profile.lumpSum || 0);
  const monthly = Math.max(0, profile.monthlyContribution || 0);
  // Amortize the lump sum over a year for tiering only — a $50k lump and
  // $0/mo is a tier-3 book even if it never gets another dollar.
  const annualDeploy = monthly * 12 + lumpSum;
  const tier = capacityTierFor(annualDeploy);

  // ── Cash buffer (the 5% rule), widened for short horizons ──
  let cashPct = bucket === "short" ? 20 : 5;

  // ── Equity vs bonds ──
  let equityPct = clampPct(baseEquityForBucket(bucket) + riskEquityDelta(profile.riskTolerance));
  // Preservation goal pulls risk down a notch regardless of stated tolerance.
  if (profile.goals.includes("preservation")) equityPct = clampPct(equityPct - 10);

  let bondPct = clampPct(100 - cashPct - equityPct);

  if (has(g, "noBonds")) {
    // Reallocate the bond sleeve: half into a slightly wider cash buffer, half
    // back into equity (the investor explicitly accepts the volatility).
    const reclaimed = bondPct;
    bondPct = 0;
    cashPct = clampPct(cashPct + reclaimed * 0.4);
    equityPct = clampPct(100 - cashPct);
  }

  // ── Inflation hedge sleeve (alt) — only if requested, capped small ──
  let altPct = 0;
  if (has(g, "addHedge")) {
    altPct = tier >= 3 ? 7 : 5;
    // Carve the hedge out of equity (it's a diversifier away from stocks).
    equityPct = clampPct(equityPct - altPct);
  }

  // Renormalize so the four top-level buckets sum to 100.
  const sum = equityPct + bondPct + cashPct + altPct;
  if (sum !== 100 && sum > 0) {
    equityPct = clampPct((equityPct / sum) * 100);
    bondPct = clampPct((bondPct / sum) * 100);
    cashPct = clampPct((cashPct / sum) * 100);
    altPct = clampPct((altPct / sum) * 100);
  }

  // ── Split the equity bucket into sleeves ──
  // International tilt unless usOnly.
  const intlShareOfEquity = has(g, "usOnly") ? 0 : bucket === "short" ? 0.1 : 0.18;
  // Dividend sleeve if the user wants income or tilts dividend.
  const wantsIncome = profile.goals.includes("income") || has(g, "dividendFocus");
  const dividendShareOfEquity = wantsIncome ? 0.25 : 0;
  // Satellites only for tier >= 3, growth/aggressive risk, not index-only,
  // and a long-enough horizon to ride out single-name volatility.
  const satellitesAllowed =
    !has(g, "indexOnly") &&
    tier >= 3 &&
    (profile.riskTolerance === "growth" || profile.riskTolerance === "aggressive") &&
    (bucket === "long" || bucket === "veryLong");
  const satelliteShareOfEquity = satellitesAllowed ? (profile.riskTolerance === "aggressive" ? 0.3 : 0.2) : 0;

  const coreShareOfEquity = Math.max(
    0,
    1 - intlShareOfEquity - dividendShareOfEquity - satelliteShareOfEquity
  );

  const mk = (assetClass: AssetClass, pct: number): BaselineSleeve => ({
    assetClass,
    targetPct: round1(pct),
    amountUSD: Math.round((pct / 100) * lumpSum),
    monthlyUSD: Math.round((pct / 100) * monthly),
  });

  const sleeves: BaselineSleeve[] = [];
  if (equityPct > 0) {
    sleeves.push(mk("Core US Equity", equityPct * coreShareOfEquity));
    if (intlShareOfEquity > 0) sleeves.push(mk("International Equity", equityPct * intlShareOfEquity));
    if (dividendShareOfEquity > 0) sleeves.push(mk("Dividend / Income", equityPct * dividendShareOfEquity));
    if (satelliteShareOfEquity > 0) sleeves.push(mk("Satellite / Single Stocks", equityPct * satelliteShareOfEquity));
  }
  if (bondPct > 0) sleeves.push(mk("Bonds", bondPct));
  if (altPct > 0) sleeves.push(mk("Inflation Hedge", altPct));
  if (cashPct > 0) sleeves.push(mk("Cash Buffer", cashPct));

  sleeves.sort((a, b) => b.targetPct - a.targetPct);

  const prerequisites = buildPrerequisites(profile);
  const candidateUniverse = buildUniverse(profile, bucket, tier, sleeves);

  const notes: string[] = [];
  notes.push(
    `Horizon ${profile.horizonYears}y (${bucket}), ${profile.riskTolerance} risk → base equity ${round1(equityPct)}%, bonds ${round1(bondPct)}%, cash ${round1(cashPct)}%${altPct > 0 ? `, hedge ${round1(altPct)}%` : ""}.`
  );
  notes.push(
    `Capacity: $${lumpSum.toLocaleString()} lump + $${monthly.toLocaleString()}/mo (tier ${tier}). ${satellitesAllowed ? "Satellites unlocked." : "Index-core only — no single-stock satellites at this profile."}`
  );
  if (has(g, "usOnly")) notes.push("Guardrail: US only — no international sleeve.");
  if (has(g, "noBonds")) notes.push("Guardrail: no bonds — bond sleeve reallocated to cash + equity.");
  if (wantsIncome) notes.push("Income tilt: dedicated dividend sleeve carved from equity.");
  if (has(g, "esgTilt")) notes.push("Guardrail: ESG tilt — core uses a broad ESG fund.");
  if (prerequisites.some((p) => p.blocking))
    notes.push("Prerequisite gate active: deploy the allocation only with capital beyond debt payoff / emergency fund.");

  return {
    bucket,
    capacityTier: tier,
    annualDeploy,
    equityPct: round1(equityPct),
    bondPct: round1(bondPct),
    cashPct: round1(cashPct),
    altPct: round1(altPct),
    sleeves,
    prerequisites,
    candidateUniverse,
    notes,
  };
}

// ── Briefs for the model layer ─────────────────────────────────────────────────

const RISK_LABEL: Record<InvestorProfile["riskTolerance"], string> = {
  conservative: "Conservative (capital preservation, low volatility)",
  balanced: "Balanced (steady growth, moderate volatility)",
  growth: "Growth (long-term appreciation, accepts drawdowns)",
  aggressive: "Aggressive (maximum growth, high volatility tolerance)",
};

const GOAL_LABEL: Record<Goal, string> = {
  retirement: "Retirement",
  wealth: "Long-term wealth building",
  house: "House down payment",
  income: "Passive income",
  education: "Education",
  bigPurchase: "A large planned purchase",
  preservation: "Capital preservation",
};

export function renderProfileBrief(p: InvestorProfile): string {
  const lines: string[] = [];
  lines.push(
    `Capacity: $${(p.lumpSum || 0).toLocaleString()} to invest now + $${(p.monthlyContribution || 0).toLocaleString()}/month ongoing.`
  );
  lines.push(`Risk tolerance: ${RISK_LABEL[p.riskTolerance]}.`);
  lines.push(`Time horizon: ${p.horizonYears} years (${bucketFor(p.horizonYears)}).`);
  lines.push(`Goals: ${p.goals.map((g) => GOAL_LABEL[g]).join(", ") || "unspecified"}.`);
  lines.push(
    `Prerequisites: high-interest debt = ${p.highInterestDebt ? "YES" : "no"}; emergency fund in place = ${p.hasEmergencyFund ? "YES" : "no"}.`
  );
  const guard = p.guardrails.length ? p.guardrails.join(", ") : "none";
  lines.push(`Guardrails: ${guard}.`);
  if (p.age) lines.push(`Age: ${p.age}.`);
  if (p.notes?.trim()) lines.push(`Notes: ${p.notes.trim().slice(0, 280)}`);
  return lines.join("\n");
}

export function renderBaselineBrief(b: Baseline): string {
  const lines: string[] = [];
  // Explicitly frame equityPct as a starting point, not a fixed answer.
  // The dollar capacity amounts (amountUSD/monthlyUSD) ARE fixed to the user's
  // inputs and should not change. The equity/bond/cash split is the DEBATE.
  lines.push(
    `FRAMEWORK SKELETON — capacity tier ${b.capacityTier}:`
  );
  lines.push(
    `Starting-point equity: ${b.equityPct}% (THIS IS YOUR ARGUMENT SEED — push it up or down based on your lane. See your instructions.)`
  );
  lines.push(
    `Starting splits: equity ${b.equityPct}% / bonds ${b.bondPct}% / cash ${b.cashPct}% / hedge ${b.altPct}%.`
  );
  lines.push("Capacity sleeves (dollar amounts are fixed by user's inputs — do not change these):");
  for (const s of b.sleeves) {
    lines.push(
      `- ${s.assetClass}: ${s.targetPct}%` +
        (s.amountUSD > 0 ? ` ($${s.amountUSD.toLocaleString()} capacity)` : "") +
        (s.monthlyUSD > 0 ? ` + $${s.monthlyUSD.toLocaleString()}/mo` : "")
    );
  }
  if (b.notes.length) {
    lines.push("Engine notes:");
    for (const n of b.notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}

export function renderVehicleBrief(vehicles: { ticker: string; name: string; assetClass: string; price?: string; expenseRatio?: string; yield?: string; sourceIndexes: number[] }[]): string {
  if (!vehicles.length) return "No vehicle facts available.";
  return vehicles
    .map((v) => {
      const bits: string[] = [];
      if (v.price) bits.push(`price ${v.price}`);
      if (v.expenseRatio) bits.push(`expense ${v.expenseRatio}`);
      if (v.yield) bits.push(`yield ${v.yield}`);
      const cite = v.sourceIndexes.length ? ` (${v.sourceIndexes.map((i) => `#${i}`).join(", ")})` : "";
      return `- ${v.ticker} — ${v.name} [${v.assetClass}]: ${bits.join(", ") || "no live quote"}${cite}`;
    })
    .join("\n");
}
