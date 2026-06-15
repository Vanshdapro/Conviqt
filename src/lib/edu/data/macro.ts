// US macro series — STATIC, public-domain, hand-curated annual values.
//
// CLAUDE.md bans the FRED API; this is the founder-approved alternative: a
// small committed dataset of real public-domain figures, no live API, $0, and
// perfectly reproducible (which is exactly what an academic citation needs).
//
// Sources (all public domain / US Government works):
//   • Fed funds  — Federal Reserve, effective federal funds rate, annual avg %.
//   • Inflation  — US BLS, CPI-U, annual average year-over-year %.
//   • Corp tax   — US top federal statutory corporate income tax rate %
//                  (the Tax Cuts and Jobs Act cut 35% → 21%, effective 2018).
//
// Annual granularity is forward-filled to each month by `macroAt()`. The corp
// tax 35→21 step in 2018 is the cleanest natural experiment for teaching.

export interface MacroVector {
  rate: number; // effective fed funds, %
  inflation: number; // CPI-U YoY, %
  tax: number; // top federal statutory corporate rate, %
}

export type MacroFactor = keyof MacroVector;

export const MACRO_FACTORS: MacroFactor[] = ["rate", "inflation", "tax"];

export const MACRO_LABELS: Record<MacroFactor, string> = {
  rate: "Interest Rate",
  inflation: "Inflation Rate",
  tax: "Corporate Tax Rate",
};

export const MACRO_SOURCE: Record<MacroFactor, string> = {
  rate: "Federal Reserve — effective federal funds rate (annual avg)",
  inflation: "US Bureau of Labor Statistics — CPI-U, annual avg YoY",
  tax: "US top federal statutory corporate income tax rate",
};

// Annual series, keyed by calendar year. Covers the 10-year price snapshot
// window with one year of lead-in.
const ANNUAL: Record<number, MacroVector> = {
  2015: { rate: 0.13, inflation: 0.1, tax: 35 },
  2016: { rate: 0.4, inflation: 1.3, tax: 35 },
  2017: { rate: 1.0, inflation: 2.1, tax: 35 },
  2018: { rate: 1.83, inflation: 2.4, tax: 21 },
  2019: { rate: 2.16, inflation: 1.8, tax: 21 },
  2020: { rate: 0.38, inflation: 1.2, tax: 21 },
  2021: { rate: 0.08, inflation: 4.7, tax: 21 },
  2022: { rate: 1.68, inflation: 8.0, tax: 21 },
  2023: { rate: 5.03, inflation: 4.1, tax: 21 },
  2024: { rate: 5.13, inflation: 2.9, tax: 21 },
  2025: { rate: 4.5, inflation: 2.7, tax: 21 },
  2026: { rate: 4.25, inflation: 2.6, tax: 21 },
};

const YEARS = Object.keys(ANNUAL).map(Number).sort((a, b) => a - b);
const MIN_YEAR = YEARS[0];
const MAX_YEAR = YEARS[YEARS.length - 1];

// Macro vector prevailing in a given "YYYY-MM" month (annual value forward-fill,
// clamped to the series bounds).
export function macroAt(month: string): MacroVector {
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, Number(month.slice(0, 4))));
  return ANNUAL[year] ?? ANNUAL[MAX_YEAR];
}

// Most recent observed regime — the slider defaults / scenario baseline.
export const MACRO_BASELINE: MacroVector = ANNUAL[MAX_YEAR];

// Plausible slider bounds for the UI (teaching ranges, not hard limits).
export const MACRO_RANGE: Record<MacroFactor, { min: number; max: number; step: number }> = {
  rate: { min: 0, max: 12, step: 0.25 },
  inflation: { min: -2, max: 15, step: 0.1 },
  tax: { min: 0, max: 45, step: 1 },
};
