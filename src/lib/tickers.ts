// The public stock-page universe.
//
// These are the tickers we pre-generate /stock/[ticker] pages for
// (generateStaticParams) and list in the sitemap. The goal is to own the
// high-intent organic queries ("NVDA analysis", "AAPL buy or sell") that
// currently flow to Seeking Alpha / Motley Fool.
//
// Scope per Deliverable 1: the S&P 500 large caps plus the most-searched
// Nasdaq names. The list is intentionally curated rather than exhaustive —
// obscure index constituents get negligible search volume, and every entry
// here is a page we may eventually run the Council on, so it must carry real
// SEO intent. Company names are used for metadata + the "report pending"
// state before a Council run has populated the page.
//
// A ticker NOT in this list still renders (the route allows dynamic params),
// it just isn't pre-built or sitemap-listed.

export interface UniverseEntry {
  ticker: string;
  name: string;
}

// Kept as [ticker, name] tuples for compactness. Sorted roughly by sector
// then alphabetically; order doesn't matter functionally.
const RAW: Array<[string, string]> = [
  // ── Mega-cap tech ──────────────────────────────────────────────────────
  ["AAPL", "Apple Inc."],
  ["MSFT", "Microsoft Corporation"],
  ["NVDA", "NVIDIA Corporation"],
  ["GOOGL", "Alphabet Inc. (Class A)"],
  ["GOOG", "Alphabet Inc. (Class C)"],
  ["AMZN", "Amazon.com, Inc."],
  ["META", "Meta Platforms, Inc."],
  ["TSLA", "Tesla, Inc."],
  ["AVGO", "Broadcom Inc."],
  ["ORCL", "Oracle Corporation"],
  ["CRM", "Salesforce, Inc."],
  ["ADBE", "Adobe Inc."],
  ["AMD", "Advanced Micro Devices, Inc."],
  ["INTC", "Intel Corporation"],
  ["QCOM", "QUALCOMM Incorporated"],
  ["CSCO", "Cisco Systems, Inc."],
  ["TXN", "Texas Instruments Incorporated"],
  ["IBM", "International Business Machines Corporation"],
  ["NOW", "ServiceNow, Inc."],
  ["INTU", "Intuit Inc."],
  ["AMAT", "Applied Materials, Inc."],
  ["MU", "Micron Technology, Inc."],
  ["LRCX", "Lam Research Corporation"],
  ["KLAC", "KLA Corporation"],
  ["ADI", "Analog Devices, Inc."],
  ["MRVL", "Marvell Technology, Inc."],
  ["SNPS", "Synopsys, Inc."],
  ["CDNS", "Cadence Design Systems, Inc."],
  ["PANW", "Palo Alto Networks, Inc."],
  ["CRWD", "CrowdStrike Holdings, Inc."],
  ["FTNT", "Fortinet, Inc."],
  ["ANET", "Arista Networks, Inc."],
  ["DELL", "Dell Technologies Inc."],
  ["HPQ", "HP Inc."],
  ["MCHP", "Microchip Technology Incorporated"],
  ["ON", "ON Semiconductor Corporation"],
  ["NXPI", "NXP Semiconductors N.V."],
  ["WDAY", "Workday, Inc."],
  ["TEAM", "Atlassian Corporation"],
  ["DDOG", "Datadog, Inc."],
  ["SNOW", "Snowflake Inc."],
  ["NET", "Cloudflare, Inc."],
  ["ZS", "Zscaler, Inc."],
  ["MDB", "MongoDB, Inc."],
  ["PLTR", "Palantir Technologies Inc."],
  ["UBER", "Uber Technologies, Inc."],
  ["ABNB", "Airbnb, Inc."],
  ["SHOP", "Shopify Inc."],
  ["SQ", "Block, Inc."],
  ["PYPL", "PayPal Holdings, Inc."],
  ["COIN", "Coinbase Global, Inc."],
  ["HOOD", "Robinhood Markets, Inc."],
  ["SMCI", "Super Micro Computer, Inc."],
  ["ARM", "Arm Holdings plc"],
  ["MSTR", "MicroStrategy Incorporated"],
  ["DOCU", "DocuSign, Inc."],
  ["ROKU", "Roku, Inc."],
  ["SPOT", "Spotify Technology S.A."],
  ["PINS", "Pinterest, Inc."],
  ["SNAP", "Snap Inc."],
  ["RBLX", "Roblox Corporation"],
  ["DASH", "DoorDash, Inc."],
  ["ZM", "Zoom Video Communications, Inc."],
  ["TTD", "The Trade Desk, Inc."],

  // ── Communication / media ─────────────────────────────────────────────
  ["NFLX", "Netflix, Inc."],
  ["DIS", "The Walt Disney Company"],
  ["CMCSA", "Comcast Corporation"],
  ["T", "AT&T Inc."],
  ["VZ", "Verizon Communications Inc."],
  ["TMUS", "T-Mobile US, Inc."],
  ["WBD", "Warner Bros. Discovery, Inc."],
  ["PARA", "Paramount Global"],
  ["EA", "Electronic Arts Inc."],
  ["TTWO", "Take-Two Interactive Software, Inc."],

  // ── Financials ─────────────────────────────────────────────────────────
  ["BRK.B", "Berkshire Hathaway Inc. (Class B)"],
  ["JPM", "JPMorgan Chase & Co."],
  ["V", "Visa Inc."],
  ["MA", "Mastercard Incorporated"],
  ["BAC", "Bank of America Corporation"],
  ["WFC", "Wells Fargo & Company"],
  ["GS", "The Goldman Sachs Group, Inc."],
  ["MS", "Morgan Stanley"],
  ["C", "Citigroup Inc."],
  ["SCHW", "The Charles Schwab Corporation"],
  ["BLK", "BlackRock, Inc."],
  ["AXP", "American Express Company"],
  ["SPGI", "S&P Global Inc."],
  ["CB", "Chubb Limited"],
  ["PGR", "The Progressive Corporation"],
  ["MMC", "Marsh & McLennan Companies, Inc."],
  ["PNC", "The PNC Financial Services Group, Inc."],
  ["USB", "U.S. Bancorp"],
  ["TFC", "Truist Financial Corporation"],
  ["COF", "Capital One Financial Corporation"],
  ["BK", "The Bank of New York Mellon Corporation"],
  ["AON", "Aon plc"],
  ["ICE", "Intercontinental Exchange, Inc."],
  ["CME", "CME Group Inc."],
  ["MCO", "Moody's Corporation"],
  ["AIG", "American International Group, Inc."],
  ["MET", "MetLife, Inc."],
  ["PRU", "Prudential Financial, Inc."],
  ["KKR", "KKR & Co. Inc."],
  ["BX", "Blackstone Inc."],

  // ── Healthcare ─────────────────────────────────────────────────────────
  ["UNH", "UnitedHealth Group Incorporated"],
  ["JNJ", "Johnson & Johnson"],
  ["LLY", "Eli Lilly and Company"],
  ["ABBV", "AbbVie Inc."],
  ["MRK", "Merck & Co., Inc."],
  ["PFE", "Pfizer Inc."],
  ["TMO", "Thermo Fisher Scientific Inc."],
  ["ABT", "Abbott Laboratories"],
  ["DHR", "Danaher Corporation"],
  ["AMGN", "Amgen Inc."],
  ["ISRG", "Intuitive Surgical, Inc."],
  ["MDT", "Medtronic plc"],
  ["GILD", "Gilead Sciences, Inc."],
  ["BMY", "Bristol-Myers Squibb Company"],
  ["VRTX", "Vertex Pharmaceuticals Incorporated"],
  ["REGN", "Regeneron Pharmaceuticals, Inc."],
  ["CVS", "CVS Health Corporation"],
  ["CI", "The Cigna Group"],
  ["ELV", "Elevance Health, Inc."],
  ["HCA", "HCA Healthcare, Inc."],
  ["BSX", "Boston Scientific Corporation"],
  ["SYK", "Stryker Corporation"],
  ["BDX", "Becton, Dickinson and Company"],
  ["ZTS", "Zoetis Inc."],
  ["MRNA", "Moderna, Inc."],
  ["BIIB", "Biogen Inc."],
  ["IDXX", "IDEXX Laboratories, Inc."],
  ["DXCM", "DexCom, Inc."],
  ["HUM", "Humana Inc."],

  // ── Consumer ───────────────────────────────────────────────────────────
  ["WMT", "Walmart Inc."],
  ["PG", "The Procter & Gamble Company"],
  ["KO", "The Coca-Cola Company"],
  ["PEP", "PepsiCo, Inc."],
  ["COST", "Costco Wholesale Corporation"],
  ["MCD", "McDonald's Corporation"],
  ["HD", "The Home Depot, Inc."],
  ["LOW", "Lowe's Companies, Inc."],
  ["NKE", "NIKE, Inc."],
  ["SBUX", "Starbucks Corporation"],
  ["TGT", "Target Corporation"],
  ["LULU", "Lululemon Athletica Inc."],
  ["BKNG", "Booking Holdings Inc."],
  ["MAR", "Marriott International, Inc."],
  ["CMG", "Chipotle Mexican Grill, Inc."],
  ["MDLZ", "Mondelez International, Inc."],
  ["CL", "Colgate-Palmolive Company"],
  ["MO", "Altria Group, Inc."],
  ["PM", "Philip Morris International Inc."],
  ["EL", "The Estée Lauder Companies Inc."],
  ["KHC", "The Kraft Heinz Company"],
  ["GIS", "General Mills, Inc."],
  ["MNST", "Monster Beverage Corporation"],
  ["KDP", "Keurig Dr Pepper Inc."],
  ["YUM", "Yum! Brands, Inc."],
  ["ORLY", "O'Reilly Automotive, Inc."],
  ["AZO", "AutoZone, Inc."],
  ["ROST", "Ross Stores, Inc."],
  ["TJX", "The TJX Companies, Inc."],
  ["F", "Ford Motor Company"],
  ["GM", "General Motors Company"],
  ["RIVN", "Rivian Automotive, Inc."],
  ["LCID", "Lucid Group, Inc."],
  ["DKNG", "DraftKings Inc."],

  // ── Industrials / transport ───────────────────────────────────────────
  ["CAT", "Caterpillar Inc."],
  ["BA", "The Boeing Company"],
  ["HON", "Honeywell International Inc."],
  ["GE", "GE Aerospace"],
  ["RTX", "RTX Corporation"],
  ["UNP", "Union Pacific Corporation"],
  ["UPS", "United Parcel Service, Inc."],
  ["FDX", "FedEx Corporation"],
  ["LMT", "Lockheed Martin Corporation"],
  ["DE", "Deere & Company"],
  ["GD", "General Dynamics Corporation"],
  ["NOC", "Northrop Grumman Corporation"],
  ["EMR", "Emerson Electric Co."],
  ["ETN", "Eaton Corporation plc"],
  ["ITW", "Illinois Tool Works Inc."],
  ["CSX", "CSX Corporation"],
  ["NSC", "Norfolk Southern Corporation"],
  ["WM", "Waste Management, Inc."],
  ["MMM", "3M Company"],
  ["PH", "Parker-Hannifin Corporation"],
  ["DAL", "Delta Air Lines, Inc."],
  ["UAL", "United Airlines Holdings, Inc."],
  ["LUV", "Southwest Airlines Co."],

  // ── Energy ─────────────────────────────────────────────────────────────
  ["XOM", "Exxon Mobil Corporation"],
  ["CVX", "Chevron Corporation"],
  ["COP", "ConocoPhillips"],
  ["SLB", "Schlumberger Limited"],
  ["EOG", "EOG Resources, Inc."],
  ["MPC", "Marathon Petroleum Corporation"],
  ["PSX", "Phillips 66"],
  ["VLO", "Valero Energy Corporation"],
  ["OXY", "Occidental Petroleum Corporation"],
  ["WMB", "The Williams Companies, Inc."],
  ["KMI", "Kinder Morgan, Inc."],
  ["DVN", "Devon Energy Corporation"],

  // ── Utilities / real estate ───────────────────────────────────────────
  ["NEE", "NextEra Energy, Inc."],
  ["DUK", "Duke Energy Corporation"],
  ["SO", "The Southern Company"],
  ["D", "Dominion Energy, Inc."],
  ["AEP", "American Electric Power Company, Inc."],
  ["PLD", "Prologis, Inc."],
  ["AMT", "American Tower Corporation"],
  ["EQIX", "Equinix, Inc."],
  ["CCI", "Crown Castle Inc."],
  ["O", "Realty Income Corporation"],
  ["SPG", "Simon Property Group, Inc."],

  // ── Materials ──────────────────────────────────────────────────────────
  ["LIN", "Linde plc"],
  ["SHW", "The Sherwin-Williams Company"],
  ["APD", "Air Products and Chemicals, Inc."],
  ["ECL", "Ecolab Inc."],
  ["FCX", "Freeport-McMoRan Inc."],
  ["NEM", "Newmont Corporation"],
  ["DOW", "Dow Inc."],
  ["NUE", "Nucor Corporation"],
];

export const STOCK_UNIVERSE: UniverseEntry[] = RAW.map(([ticker, name]) => ({
  ticker,
  name,
}));

// Fast lookup for company name + universe membership.
const BY_TICKER = new Map<string, UniverseEntry>(
  STOCK_UNIVERSE.map((e) => [e.ticker, e])
);

export function isUniverseTicker(ticker: string): boolean {
  return BY_TICKER.has(ticker.toUpperCase());
}

export function universeName(ticker: string): string | undefined {
  return BY_TICKER.get(ticker.toUpperCase())?.name;
}

// URL slugs are lowercase. Berkshire's "BRK.B" → "brk.b" works as a path
// segment, but we expose a helper so callers don't hand-roll casing.
export function tickerToSlug(ticker: string): string {
  return ticker.toLowerCase();
}

export function slugToTicker(slug: string): string {
  return decodeURIComponent(slug).toUpperCase();
}

// ── Head-to-head compare pairs ────────────────────────────────────────────
//
// Powers /compare/[pair]. A pair is canonicalized by sorting the two tickers
// alphabetically (same ordering as compareCacheKey in cache.ts), so
// "MSFT vs AAPL" and "AAPL vs MSFT" collapse to ONE canonical URL
// (/compare/aapl-vs-msft). The page 301s the non-canonical order to the
// canonical one so Google never sees duplicate content across both spellings.
//
// The slug separator is "-vs-". Tickers are letters + optional .A/.B, so they
// never contain "-vs-" and the split is unambiguous (e.g. brk.b-vs-jpm).

export interface ComparePair {
  a: string; // alphabetically-first ticker (uppercase)
  b: string; // alphabetically-second ticker (uppercase)
}

// Canonical storage key — "AAPL|MSFT". Order-independent; mirrors compareCacheKey.
export function comparePairKey(a: string, b: string): string {
  return [a.toUpperCase(), b.toUpperCase()].sort().join("|");
}

// Canonical URL slug — "aapl-vs-msft" (sorted, lowercased).
export function comparePairToSlug(a: string, b: string): string {
  return [a.toUpperCase(), b.toUpperCase()]
    .sort()
    .map((t) => t.toLowerCase())
    .join("-vs-");
}

// Parse a slug into the canonical {a, b} pair, or null if it isn't a valid
// "x-vs-y" of two DISTINCT tickers. Always returns sorted order, so the caller
// can compare the input slug against comparePairToSlug(a, b) to detect a
// non-canonical (reverse-order / wrong-case) request and redirect.
export function slugToComparePair(slug: string): ComparePair | null {
  const parts = decodeURIComponent(slug).toLowerCase().split("-vs-");
  if (parts.length !== 2) return null;
  const [x, y] = parts.map((p) => p.trim().toUpperCase());
  if (!x || !y || x === y) return null;
  const [a, b] = [x, y].sort();
  return { a, b };
}

// Curated high-search-volume matchups we pre-generate (generateStaticParams)
// and surface on the /compare hub for internal linking. Every ticker here is a
// STOCK_UNIVERSE member so the cross-links resolve to a real /stock page. The
// pages stay noindex until a real cached Compare run populates them — this list
// only warms the shell + seeds the internal link graph.
const COMPARE_RAW: Array<[string, string]> = [
  // Semis / AI hardware
  ["NVDA", "AMD"],
  ["AMD", "INTC"],
  ["NVDA", "INTC"],
  ["AVGO", "QCOM"],
  ["ARM", "QCOM"],
  ["MU", "INTC"],
  ["SMCI", "DELL"],
  ["NVDA", "AVGO"],
  ["NVDA", "AMAT"],
  ["AMAT", "LRCX"],
  ["AMAT", "KLAC"],
  ["LRCX", "KLAC"],
  ["TXN", "ADI"],
  ["TXN", "QCOM"],
  ["MRVL", "AVGO"],
  ["ON", "NXPI"],
  ["CSCO", "ANET"],
  ["SMCI", "HPQ"],
  // Mega-cap tech
  ["AAPL", "MSFT"],
  ["MSFT", "GOOGL"],
  ["AAPL", "GOOGL"],
  ["GOOGL", "META"],
  ["META", "SNAP"],
  ["AMZN", "WMT"],
  ["AMZN", "SHOP"],
  ["MSFT", "AMZN"],
  ["AAPL", "AMZN"],
  // Software / cloud / enterprise
  ["CRM", "NOW"],
  ["SNOW", "DDOG"],
  ["PLTR", "SNOW"],
  ["CRWD", "PANW"],
  ["PANW", "ZS"],
  ["NET", "CRWD"],
  ["MSFT", "ORCL"],
  ["ADBE", "MSFT"],
  ["WDAY", "NOW"],
  ["TEAM", "CRM"],
  ["MDB", "SNOW"],
  ["DOCU", "ADBE"],
  ["ZM", "MSFT"],
  ["IBM", "ORCL"],
  ["PLTR", "IBM"],
  ["INTU", "CRM"],
  ["WDAY", "CRM"],
  ["TEAM", "DDOG"],
  ["ZM", "TEAM"],
  // Cybersecurity
  ["FTNT", "CRWD"],
  ["FTNT", "PANW"],
  ["FTNT", "ZS"],
  ["NET", "ZS"],
  // Growth tech / social / media
  ["SNAP", "PINS"],
  ["TTD", "META"],
  ["ROKU", "NFLX"],
  ["SPOT", "NFLX"],
  ["SPOT", "AAPL"],
  ["RBLX", "EA"],
  ["EA", "TTWO"],
  ["MSTR", "COIN"],
  // EV / autos
  ["TSLA", "RIVN"],
  ["TSLA", "LCID"],
  ["RIVN", "LCID"],
  ["F", "GM"],
  ["TSLA", "F"],
  ["TSLA", "GM"],
  // Fintech / payments
  ["V", "MA"],
  ["PYPL", "SQ"],
  ["COIN", "HOOD"],
  ["V", "AXP"],
  ["MA", "AXP"],
  ["COF", "AXP"],
  // Financials
  ["JPM", "BAC"],
  ["GS", "MS"],
  ["JPM", "C"],
  ["WFC", "JPM"],
  ["WFC", "BAC"],
  ["C", "BAC"],
  ["BX", "KKR"],
  ["BLK", "SCHW"],
  ["CME", "ICE"],
  ["MCO", "SPGI"],
  ["PGR", "CB"],
  // Consumer staples / food & bev
  ["KO", "PEP"],
  ["KO", "MNST"],
  ["PEP", "MNST"],
  ["PG", "CL"],
  ["MO", "PM"],
  ["KHC", "GIS"],
  ["MDLZ", "KHC"],
  // Consumer discretionary / retail
  ["MCD", "SBUX"],
  ["MCD", "CMG"],
  ["CMG", "YUM"],
  ["HD", "LOW"],
  ["NKE", "LULU"],
  ["COST", "WMT"],
  ["TGT", "WMT"],
  ["ROST", "TJX"],
  ["ORLY", "AZO"],
  ["BKNG", "ABNB"],
  ["BKNG", "MAR"],
  // Telecom
  ["T", "VZ"],
  ["TMUS", "VZ"],
  ["T", "TMUS"],
  ["CMCSA", "DIS"],
  // Media / streaming
  ["DIS", "NFLX"],
  ["NFLX", "WBD"],
  ["NFLX", "PARA"],
  ["WBD", "PARA"],
  // Travel / gig
  ["UBER", "DASH"],
  ["UBER", "ABNB"],
  ["DAL", "UAL"],
  ["DAL", "LUV"],
  // Healthcare — pharma / biotech
  ["UNH", "CVS"],
  ["PFE", "MRNA"],
  ["LLY", "ABBV"],
  ["LLY", "MRK"],
  ["PFE", "JNJ"],
  ["ABBV", "AMGN"],
  ["ABBV", "JNJ"],
  ["MRK", "JNJ"],
  ["VRTX", "REGN"],
  ["GILD", "BIIB"],
  ["MRNA", "BIIB"],
  ["AMGN", "BIIB"],
  ["AMGN", "REGN"],
  // Healthcare — devices / instruments
  ["TMO", "DHR"],
  ["ISRG", "MDT"],
  ["BSX", "MDT"],
  ["SYK", "MDT"],
  ["ISRG", "BSX"],
  ["ABT", "DHR"],
  // Healthcare — managed care
  ["UNH", "HUM"],
  ["UNH", "ELV"],
  ["CI", "HUM"],
  ["ELV", "CI"],
  // Industrials / aerospace
  ["BA", "LMT"],
  ["CAT", "DE"],
  ["UPS", "FDX"],
  ["GE", "HON"],
  ["HON", "MMM"],
  ["RTX", "LMT"],
  ["RTX", "NOC"],
  ["GD", "LMT"],
  ["GD", "NOC"],
  ["CSX", "NSC"],
  ["UNP", "NSC"],
  ["ETN", "HON"],
  // Energy — oil & gas
  ["XOM", "CVX"],
  ["COP", "XOM"],
  ["COP", "CVX"],
  ["OXY", "COP"],
  ["EOG", "COP"],
  ["WMB", "KMI"],
  // Utilities / clean energy
  ["NEE", "DUK"],
  ["NEE", "SO"],
  ["DUK", "D"],
  ["AEP", "NEE"],
  // REITs
  ["AMT", "CCI"],
  ["PLD", "EQIX"],
  ["EQIX", "AMT"],
  ["O", "SPG"],
  ["PLD", "O"],
  // Materials
  ["FCX", "NEM"],
  ["LIN", "APD"],
  ["SHW", "ECL"],
  ["LIN", "DOW"],
];

// De-duplicated, canonicalized list of compare pairs for static generation.
export const COMPARE_UNIVERSE: ComparePair[] = (() => {
  const seen = new Set<string>();
  const out: ComparePair[] = [];
  for (const [a, b] of COMPARE_RAW) {
    const key = comparePairKey(a, b);
    if (seen.has(key)) continue;
    seen.add(key);
    const [x, y] = [a.toUpperCase(), b.toUpperCase()].sort();
    out.push({ a: x, b: y });
  }
  return out;
})();

// Curated matchups that include `ticker` — powers the "Head-to-head" cross-link
// block on /stock/[ticker], wiring ticker pages into the compare link graph.
export function comparePairsFor(ticker: string, limit = 6): ComparePair[] {
  const T = ticker.toUpperCase();
  return COMPARE_UNIVERSE.filter((p) => p.a === T || p.b === T).slice(0, limit);
}
