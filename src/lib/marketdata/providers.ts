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
//  quote / history:  Stooq → Yahoo → Finnhub
//    Stooq first: years-stable CSV, EOD/delayed (delayed is fine — labeled).
//    Yahoo second: richer but angrier (rate limits, crumb games).
//    Finnhub last: dormant until FINNHUB_API_KEY is set (its adapter
//    no-ops non-retryably without a key, so listing it costs nothing).
//
//  keyStats:  Yahoo → Finnhub → Stooq
//    Yahoo first because Stooq has no market cap / P/E at all — Stooq sits
//    last as an honest *partial* fallback (52w range + volume only).

import { Capability, MarketDataProvider } from "./types";
import { stooqProvider } from "./providers/stooq";
import { yahooProvider } from "./providers/yahoo";
import { finnhubProvider } from "./providers/finnhub";

export const PROVIDER_CHAIN: Record<Capability, MarketDataProvider[]> = {
  quote: [stooqProvider, yahooProvider, finnhubProvider],
  history: [stooqProvider, yahooProvider, finnhubProvider],
  keyStats: [yahooProvider, finnhubProvider, stooqProvider],
};
