// The Skill Library registry — the single source of truth for the Research
// surface's skills (playbook Part 2.3). Names, one-liners, and categories are
// VERBATIM from the playbook table; never paraphrase them in UI copy.
//
// Client-safe: pure data + tiny helpers, no server imports. The API mapping
// (which pipeline a skill actually runs) lives in /api/chat — this module only
// describes what the user sees and what input the skill needs.

export type SkillCategory =
  | "Fundamentals"
  | "Technicals"
  | "Comparisons"
  | "Discovery"
  | "News"
  | "Sentiment"
  | "Portfolio";

/** Category display order — mirrors the playbook table's first appearance. */
export const SKILL_CATEGORIES: SkillCategory[] = [
  "Fundamentals",
  "Technicals",
  "Comparisons",
  "Discovery",
  "News",
  "Sentiment",
  "Portfolio",
];

// What the guided input asks for when a skill is armed.
export type SkillInputKind =
  | "ticker"      // one ticker, e.g. "NVDA"
  | "tickerPair"  // two tickers (Face-Off)
  | "sector"      // pick a theme from the curated baskets
  | "headline"    // paste/auto-fill a news headline
  | "allocator"   // budget + goals mini-form (Starter Portfolio)
  | "holdings";   // what you own (Portfolio Health Check)

export interface Skill {
  id: string;
  /** Verbatim playbook name, e.g. "Worth Owning?" */
  name: string;
  /** Verbatim playbook one-liner, with the original quotes removed. */
  oneLiner: string;
  category: SkillCategory;
  input: SkillInputKind;
  /** Guided-input prompt shown when the skill is armed. */
  guidedPrompt: string;
  /** Honest speed expectation shown on the card. */
  speedLabel: string;
  /** Skills suggested after an answer from this one. */
  related: string[];
}

export const SKILLS: Skill[] = [
  {
    id: "worth-owning",
    name: "Worth Owning?",
    oneLiner: "Is this a company you'd want for years?",
    category: "Fundamentals",
    input: "ticker",
    guidedPrompt: "Which stock are you sizing up?",
    speedLabel: "Deep look · about a minute",
    related: ["bull-bear-map", "entry-exit-zones", "face-off"],
  },
  {
    id: "quick-take",
    name: "Quick Take",
    oneLiner: "The 30-second read on any ticker",
    category: "Fundamentals",
    input: "ticker",
    guidedPrompt: "Which ticker do you want the quick read on?",
    speedLabel: "Fast read · ~20 seconds",
    related: ["worth-owning", "crowd-check"],
  },
  {
    id: "entry-exit-zones",
    name: "Entry & Exit Zones",
    oneLiner: "Where the smart levels sit",
    category: "Technicals",
    input: "ticker",
    guidedPrompt: "Which stock's levels are you watching?",
    speedLabel: "Deep look · about a minute",
    related: ["quick-take", "crowd-check", "worth-owning"],
  },
  {
    id: "face-off",
    name: "Face-Off",
    oneLiner: "Two stocks enter. One wins.",
    category: "Comparisons",
    input: "tickerPair",
    guidedPrompt: "Pick the two stocks to put head-to-head.",
    speedLabel: "Deep look · 1–2 minutes",
    related: ["worth-owning", "sector-pulse"],
  },
  {
    id: "sector-pulse",
    name: "Sector Pulse",
    oneLiner: "What's moving a whole industry",
    category: "Discovery",
    input: "sector",
    guidedPrompt: "Which industry do you want a read on?",
    speedLabel: "Deep look · 1–2 minutes",
    related: ["face-off", "worth-owning"],
  },
  {
    id: "headline-decoder",
    name: "Headline Decoder",
    oneLiner: "Any headline → which stocks it touches and how",
    category: "News",
    input: "headline",
    guidedPrompt: "Paste the headline you want decoded.",
    speedLabel: "Fast read · ~30 seconds",
    related: ["quick-take", "crowd-check"],
  },
  {
    id: "crowd-check",
    name: "Crowd Check",
    oneLiner: "What investors are feeling vs the data",
    category: "Sentiment",
    input: "ticker",
    guidedPrompt: "Which stock's mood are you checking?",
    speedLabel: "Deep look · about a minute",
    related: ["quick-take", "bull-bear-map"],
  },
  {
    id: "bull-bear-map",
    name: "Bull & Bear Map",
    oneLiner: "Best case, worst case, base case",
    category: "Fundamentals",
    input: "ticker",
    guidedPrompt: "Which stock do you want mapped out?",
    speedLabel: "Deep look · about a minute",
    related: ["worth-owning", "entry-exit-zones"],
  },
  {
    id: "starter-portfolio",
    name: "Starter Portfolio",
    oneLiner: "From budget + goals to an actual plan",
    category: "Portfolio",
    input: "allocator",
    guidedPrompt: "Tell us your budget and what you're aiming for.",
    speedLabel: "Deep look · 1–2 minutes",
    related: ["portfolio-health-check", "worth-owning"],
  },
  {
    id: "portfolio-health-check",
    name: "Portfolio Health Check",
    oneLiner: "Stress-test what you own",
    category: "Portfolio",
    input: "holdings",
    guidedPrompt: "List what you own — ticker and share count.",
    speedLabel: "Deep look · 1–2 minutes",
    related: ["starter-portfolio", "bull-bear-map"],
  },
];

/** The two cards shown on the Research home before the Skill Library opens. */
export const FEATURED_SKILL_IDS = ["worth-owning", "face-off"] as const;

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): Skill | null {
  return BY_ID.get(id) ?? null;
}

/** Case-insensitive search across name, one-liner, and category. */
export function searchSkills(query: string): Skill[] {
  const q = query.trim().toLowerCase();
  if (!q) return SKILLS;
  return SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.oneLiner.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );
}

/** Skills grouped in playbook category order (categories with hits only). */
export function groupSkills(list: Skill[]): Array<{ category: SkillCategory; skills: Skill[] }> {
  return SKILL_CATEGORIES.map((category) => ({
    category,
    skills: list.filter((s) => s.category === category),
  })).filter((g) => g.skills.length > 0);
}
