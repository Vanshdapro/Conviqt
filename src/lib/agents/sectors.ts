// Sector baskets for the "Sector Snapshot" pipeline.
//
// A Sector Snapshot runs an abbreviated Council pass on a curated basket of
// representative tickers, then synthesizes them into one thematic verdict.
// The baskets are hardcoded on purpose (per the brief): we want a tight,
// defensible set of liquid US-listed names per theme — not a screener.
//
// Each basket groups its constituents into subSectors so the sector judge
// can answer "which subsector has the most conviction" — the question a
// single-stock analysis can never answer.
//
// Constraints honoured here:
// - 5-8 names per basket. Fewer than 5 isn't a "sector"; more than 8 blows
//   the per-run cost ceiling (each cold name costs ~2-3¢ via the sweep).
// - Every ticker is a real, liquid US-listed symbol the sweep can resolve.

export interface SectorConstituentSpec {
  ticker: string;
  subSector: string;
}

export interface SectorBasket {
  key: string; // canonical, snake_case — used for cache keys
  label: string; // display name, e.g. "AI Infrastructure"
  blurb: string; // one-line description of the theme
  // Lowercase phrases that should resolve to this basket. Matched as
  // substrings against the user's normalized request.
  aliases: string[];
  constituents: SectorConstituentSpec[];
}

export const SECTOR_BASKETS: SectorBasket[] = [
  {
    key: "ai_infrastructure",
    label: "AI Infrastructure",
    blurb: "The compute, networking, memory and power layer behind the AI buildout.",
    aliases: [
      "ai infrastructure",
      "ai infra",
      "ai buildout",
      "ai hardware",
      "ai compute",
      "artificial intelligence infrastructure",
      "ai data center",
      "ai datacenter",
    ],
    constituents: [
      { ticker: "NVDA", subSector: "Accelerators" },
      { ticker: "AMD", subSector: "Accelerators" },
      { ticker: "AVGO", subSector: "Networking / Custom silicon" },
      { ticker: "TSM", subSector: "Foundry" },
      { ticker: "MU", subSector: "Memory" },
      { ticker: "ANET", subSector: "Networking" },
      { ticker: "VRT", subSector: "Power / Cooling" },
    ],
  },
  {
    key: "semiconductors",
    label: "Semiconductors",
    blurb: "Broad semis — logic, foundry, memory, equipment and analog.",
    aliases: [
      "semiconductor",
      "semis",
      "chips",
      "chip stocks",
      "chipmakers",
      "semiconductors",
    ],
    constituents: [
      { ticker: "NVDA", subSector: "Logic / GPU" },
      { ticker: "AMD", subSector: "Logic / CPU-GPU" },
      { ticker: "INTC", subSector: "Logic / IDM" },
      { ticker: "TSM", subSector: "Foundry" },
      { ticker: "ASML", subSector: "Equipment" },
      { ticker: "QCOM", subSector: "Mobile / Analog" },
      { ticker: "MU", subSector: "Memory" },
    ],
  },
  {
    key: "mega_cap_tech",
    label: "Mega-Cap Tech",
    blurb: "The platform giants that anchor the index.",
    aliases: [
      "mega cap tech",
      "megacap tech",
      "big tech",
      "magnificent 7",
      "mag 7",
      "faang",
      "tech giants",
    ],
    constituents: [
      { ticker: "AAPL", subSector: "Consumer hardware" },
      { ticker: "MSFT", subSector: "Software / Cloud" },
      { ticker: "GOOGL", subSector: "Search / Ads" },
      { ticker: "AMZN", subSector: "E-commerce / Cloud" },
      { ticker: "META", subSector: "Social / Ads" },
      { ticker: "NVDA", subSector: "Semis / AI" },
    ],
  },
  {
    key: "cloud_software",
    label: "Cloud Software",
    blurb: "Enterprise SaaS and the platforms reselling AI to the enterprise.",
    aliases: [
      "cloud software",
      "saas",
      "enterprise software",
      "software stocks",
      "cloud stocks",
      "cloud computing",
    ],
    constituents: [
      { ticker: "MSFT", subSector: "Platform" },
      { ticker: "CRM", subSector: "Front-office SaaS" },
      { ticker: "NOW", subSector: "Workflow SaaS" },
      { ticker: "SNOW", subSector: "Data platform" },
      { ticker: "DDOG", subSector: "Observability" },
      { ticker: "ORCL", subSector: "Database / Cloud" },
    ],
  },
  {
    key: "cybersecurity",
    label: "Cybersecurity",
    blurb: "Platform consolidation across endpoint, network and identity security.",
    aliases: [
      "cybersecurity",
      "cyber security",
      "security software",
      "infosec",
      "security stocks",
    ],
    constituents: [
      { ticker: "PANW", subSector: "Platform" },
      { ticker: "CRWD", subSector: "Endpoint" },
      { ticker: "ZS", subSector: "Zero-trust / Network" },
      { ticker: "FTNT", subSector: "Network / Firewall" },
      { ticker: "S", subSector: "Endpoint" },
      { ticker: "OKTA", subSector: "Identity" },
    ],
  },
  {
    key: "energy",
    label: "Energy",
    blurb: "Integrated majors, E&P and oilfield services across the oil & gas complex.",
    aliases: [
      "energy",
      "oil",
      "oil and gas",
      "oil & gas",
      "energy stocks",
      "oil stocks",
      "fossil fuel",
    ],
    constituents: [
      { ticker: "XOM", subSector: "Integrated" },
      { ticker: "CVX", subSector: "Integrated" },
      { ticker: "COP", subSector: "E&P" },
      { ticker: "EOG", subSector: "E&P" },
      { ticker: "SLB", subSector: "Oilfield services" },
      { ticker: "MPC", subSector: "Refining" },
    ],
  },
  {
    key: "financials",
    label: "Financials / Banks",
    blurb: "Money-center banks and the broker-dealers levered to rates and markets.",
    aliases: [
      "financials",
      "banks",
      "bank stocks",
      "big banks",
      "financial sector",
      "money center banks",
    ],
    constituents: [
      { ticker: "JPM", subSector: "Money-center" },
      { ticker: "BAC", subSector: "Money-center" },
      { ticker: "WFC", subSector: "Consumer / Commercial" },
      { ticker: "GS", subSector: "Broker-dealer" },
      { ticker: "MS", subSector: "Broker-dealer / WM" },
      { ticker: "C", subSector: "Money-center" },
    ],
  },
  {
    key: "electric_vehicles",
    label: "Electric Vehicles",
    blurb: "Pure-play EV makers and the legacy OEMs racing to electrify.",
    aliases: [
      "electric vehicles",
      "ev",
      "ev stocks",
      "electric cars",
      "auto",
      "autos",
      "automakers",
    ],
    constituents: [
      { ticker: "TSLA", subSector: "Pure-play EV" },
      { ticker: "RIVN", subSector: "Pure-play EV" },
      { ticker: "LCID", subSector: "Pure-play EV" },
      { ticker: "GM", subSector: "Legacy OEM" },
      { ticker: "F", subSector: "Legacy OEM" },
    ],
  },
  {
    key: "healthcare",
    label: "Healthcare / Pharma",
    blurb: "Large-cap pharma, biotech and managed care.",
    aliases: [
      "healthcare",
      "health care",
      "pharma",
      "pharmaceutical",
      "biotech",
      "drug stocks",
      "health stocks",
    ],
    constituents: [
      { ticker: "LLY", subSector: "Pharma / GLP-1" },
      { ticker: "MRK", subSector: "Pharma" },
      { ticker: "JNJ", subSector: "Diversified" },
      { ticker: "ABBV", subSector: "Pharma" },
      { ticker: "PFE", subSector: "Pharma" },
      { ticker: "UNH", subSector: "Managed care" },
    ],
  },
  {
    key: "consumer",
    label: "Consumer / Retail",
    blurb: "The large-cap retail and consumer names that read the US consumer.",
    aliases: [
      "consumer",
      "retail",
      "consumer stocks",
      "retail stocks",
      "consumer discretionary",
      "consumer staples",
    ],
    constituents: [
      { ticker: "AMZN", subSector: "E-commerce" },
      { ticker: "WMT", subSector: "Big-box / Staples" },
      { ticker: "COST", subSector: "Warehouse" },
      { ticker: "HD", subSector: "Home improvement" },
      { ticker: "NKE", subSector: "Apparel" },
      { ticker: "MCD", subSector: "Restaurants" },
    ],
  },
];

// Deterministic resolver: map a free-text sector phrase from the router onto
// a known basket. Returns null when nothing matches confidently — the route
// then tells the user which sectors are supported rather than guessing.
export function resolveSector(input: string): SectorBasket | null {
  const q = input.toLowerCase().trim();
  if (!q) return null;

  // 1. Exact key/label match wins.
  for (const b of SECTOR_BASKETS) {
    if (b.key === q || b.label.toLowerCase() === q) return b;
  }

  // 2. Alias substring match, longest alias first so "ai infrastructure"
  //    beats a bare "ai" hit on another basket.
  const candidates: Array<{ basket: SectorBasket; alias: string }> = [];
  for (const b of SECTOR_BASKETS) {
    for (const alias of b.aliases) {
      if (q.includes(alias)) candidates.push({ basket: b, alias });
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.alias.length - a.alias.length);
    return candidates[0].basket;
  }

  return null;
}

// Human-readable list of supported themes, for the "not found" message.
export function supportedSectorLabels(): string[] {
  return SECTOR_BASKETS.map((b) => b.label);
}
