// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THE ONE FILE TO EDIT WHEN A PROVIDER DIES.                               ║
// ║                                                                           ║
// ║  Free keyless feeds (Stooq/Yahoo) 404 and 429 datacenter IPs in           ║
// ║  practice, so for launch the LIVE chain is the two keyed free-tier        ║
// ║  feeds — Twelve Data + Finnhub — with the keyless feeds as opportunistic  ║
// ║  fallbacks behind them. FMP is the paid escape hatch: dormant until       ║
// ║  FMP_API_KEY is set, in which case the chain promotes it to first.        ║
// ║  Nothing else in the codebase knows or cares which provider answered.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Current order, per capability:
//
//  quote / history:    Twelve Data → FMP → Finnhub → Stooq → Yahoo
//    Twelve Data: PRIMARY. Free tier 8 req/min, 800/day; quote + 1-day
//      time_series cover everything the UI needs. Token bucket configured
//      in twelvedata.ts; Supabase cache (15 min quote / 24 h history) makes
//      the daily wall comfortable.
//    FMP: dormant unless FMP_API_KEY is set, then takes over silently —
//      paid Starter feed for when the founder upgrades data.
//    Finnhub: realtime fallback when Twelve Data is in cooldown or returns
//      a bad symbol; free tier has no history but covers quote cleanly.
//    Stooq + Yahoo: opportunistic only; expected to fail from cloud IPs.
//
//  keyStats:           Finnhub → FMP → Yahoo → Stooq
//    Finnhub: PRIMARY. /stock/metric covers market cap + P/E + 52w range
//      for free; Twelve Data's /statistics is plan-gated so it can't lead.
//    FMP: takes over when keyed.
//    Yahoo + Stooq: last-chance partial fallbacks (Stooq has 52w + volume
//      only — partial:true).

import { Capability, MarketDataProvider } from "./types";
import { twelveDataProvider } from "./providers/twelvedata";
import { fmpProvider } from "./providers/fmp";
import { stooqProvider } from "./providers/stooq";
import { yahooProvider } from "./providers/yahoo";
import { finnhubProvider } from "./providers/finnhub";

export const PROVIDER_CHAIN: Record<Capability, MarketDataProvider[]> = {
  quote: [twelveDataProvider, fmpProvider, finnhubProvider, stooqProvider, yahooProvider],
  history: [twelveDataProvider, fmpProvider, finnhubProvider, stooqProvider, yahooProvider],
  keyStats: [finnhubProvider, fmpProvider, yahooProvider, stooqProvider],
};
