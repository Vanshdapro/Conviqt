// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  THE ONE FILE TO EDIT WHEN A PROVIDER DIES.                               ║
// ║                                                                           ║
// ║  Free keyless feeds are unofficial and WILL break someday (playbook       ║
// ║  Part 6, #3). When that day comes: reorder the arrays below, or write     ║
// ║  one new adapter implementing MarketDataProvider and slot it in here.     ║
// ║  Nothing else in the codebase knows or cares which provider answered.    ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Current order, per capability:
//
//  FMP first everywhere — the approved paid subscription (FMP Starter,
//  founder decision 2026-06-11). DORMANT until FMP_API_KEY is set in the
//  environment; without a key its adapter throws non-retryably and the
//  chain skips it at zero cost. Activation = paste the key, restart. Done.
//
//  Free keyless fallbacks behind it:
//    quote / history:  Stooq → Yahoo → Finnhub
//      Stooq: stable CSV when reachable — but it 404s non-residential IPs
//      (verified 2026-06-11), so treat it as opportunistic, not load-bearing.
//      Yahoo: richer but angrier (429s datacenter IPs, crumb games).
//      Finnhub: dormant free-key stub (FINNHUB_API_KEY); no history on
//      its free tier.
//    keyStats:  Yahoo → Finnhub → Stooq
//      Stooq last: it has no market cap / P/E at all — honest *partial*
//      fallback only (52w range + volume).

import { Capability, MarketDataProvider } from "./types";
import { fmpProvider } from "./providers/fmp";
import { stooqProvider } from "./providers/stooq";
import { yahooProvider } from "./providers/yahoo";
import { finnhubProvider } from "./providers/finnhub";

export const PROVIDER_CHAIN: Record<Capability, MarketDataProvider[]> = {
  quote: [fmpProvider, stooqProvider, yahooProvider, finnhubProvider],
  history: [fmpProvider, stooqProvider, yahooProvider, finnhubProvider],
  keyStats: [fmpProvider, yahooProvider, finnhubProvider, stooqProvider],
};
