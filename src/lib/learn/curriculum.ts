// Conviqt Learn — the static curriculum catalog.
//
// Tracks and lessons are fixed (the catalog rarely changes and must be stable
// for progress tracking + global lesson caching). The *content* of each lesson
// is authored on demand by Claude from the lesson's `objective` seed.
//
// Lesson ids are permanent cache keys — never renumber an existing lesson.

import type { Track, LessonMeta } from "./types";
import { LESSON_XP_BY_DIFFICULTY } from "./types";

function lesson(
  id: string,
  title: string,
  hook: string,
  difficulty: LessonMeta["difficulty"],
  objective: string,
): LessonMeta {
  return { id, title, hook, difficulty, xp: LESSON_XP_BY_DIFFICULTY[difficulty], objective };
}

export const TRACKS: Track[] = [
  {
    id: "money-basics",
    name: "Money Basics",
    tagline: "Earn it, keep it, grow it — before you ever buy a stock.",
    emoji: "\u{1F4B0}",
    accent: "#34d399",
    lessons: [
      lesson(
        "mb-budget-5030-20",
        "The 50/30/20 Rule",
        "Split any paycheck like a pro in 30 seconds.",
        "starter",
        "Teach a teenager the 50/30/20 budgeting rule: 50% needs, 30% wants, 20% saving/investing. Make them split a sample $200/month allowance or part-time paycheck. Use the budget_split widget.",
      ),
      lesson(
        "mb-emergency-fund",
        "Your First Safety Net",
        "Why 'boring savings' is secretly a superpower.",
        "starter",
        "Explain the emergency fund: what it is, why 3-6 months of expenses, why it lives in boring savings not stocks. Frame it for a teen with examples like a phone repair or losing a part-time job.",
      ),
      lesson(
        "mb-compound-interest",
        "The 8th Wonder: Compounding",
        "Watch $5/week become real money over time.",
        "core",
        "Teach compound interest as the single most important money idea for a young person. Show how starting early beats starting big. Attach the compound_interest widget so they can drag the time slider and feel the curve bend upward.",
      ),
      lesson(
        "mb-good-vs-bad-debt",
        "Good Debt vs Bad Debt",
        "Not all borrowing is evil — here's the line.",
        "core",
        "Differentiate productive debt (that can build wealth) from destructive debt (high-interest consumer debt, BNPL spirals). Use teen-relevant examples and explain APR simply.",
      ),
    ],
  },
  {
    id: "investing-101",
    name: "Investing 101",
    tagline: "What a stock actually is — and how not to lose your shirt.",
    emoji: "\u{1F4C8}",
    accent: "#60a5fa",
    lessons: [
      lesson(
        "i1-what-is-a-stock",
        "What Is a Stock, Really?",
        "You're buying a slice of a real business.",
        "starter",
        "Explain what a share of stock is: partial ownership of a company, why prices move, what a shareholder actually owns. Use a relatable company a teen knows (e.g. a sneaker or gaming brand).",
      ),
      lesson(
        "i1-risk-reward",
        "Risk vs Reward",
        "Why the exciting bets are the dangerous ones.",
        "core",
        "Teach the risk/reward tradeoff and that higher potential return means higher chance of loss. Bust the 'guaranteed returns' myth. Reference how Conviqt's Council always shows a bear case first.",
      ),
      lesson(
        "i1-diversification",
        "Don't Bet It All on One Horse",
        "The only free lunch in investing.",
        "core",
        "Teach diversification: why spreading money across many companies lowers risk without lowering expected return as much. Attach the diversification widget so they can see concentration risk vs a spread portfolio.",
      ),
      lesson(
        "i1-dca-index-funds",
        "Index Funds & Buying Slowly",
        "The boring strategy that beats most pros.",
        "sharp",
        "Teach dollar-cost averaging and index funds: why buying a little every month beats trying to time the market, and why most active traders underperform an index. Attach the dollar_cost_averaging widget.",
      ),
    ],
  },
  {
    id: "reading-market",
    name: "Reading the Market",
    tagline: "Decode the numbers everyone pretends to understand.",
    emoji: "\u{1F50D}",
    accent: "#f59e0b",
    lessons: [
      lesson(
        "rm-anatomy-quote",
        "Anatomy of a Stock Quote",
        "Price, market cap, P/E — finally explained.",
        "core",
        "Decode a stock quote line by line: price, daily change, market cap, P/E ratio, volume, 52-week range. Explain what each tells you in plain language for a beginner.",
      ),
      lesson(
        "rm-what-moves-price",
        "What Actually Moves a Stock",
        "Earnings, news, hype — and what's noise.",
        "core",
        "Explain the real drivers of stock prices: earnings, guidance, macro news, sentiment/hype. Help a teen separate signal from noise and resist reacting to every headline.",
      ),
      lesson(
        "rm-bull-vs-bear",
        "Bulls, Bears & Market Moods",
        "Why the same stock looks great and terrible.",
        "sharp",
        "Teach bull vs bear cases and why thoughtful investors steelman both. Tie directly to Conviqt's disagreement signal: when smart analysts disagree, that's information, not noise.",
      ),
    ],
  },
  {
    id: "how-conviqt-thinks",
    name: "How Conviqt Thinks",
    tagline: "Go behind the curtain of the AI Council.",
    emoji: "\u{1F9E0}",
    accent: "#a78bfa",
    lessons: [
      lesson(
        "hc-the-council",
        "Meet the Council",
        "Four AI analysts that argue so you don't have to.",
        "core",
        "Explain Conviqt's Council: a sweep agent gathers cited facts, four specialists (fundamentals, technicals, sentiment, macro) each vote BUY/HOLD/SELL, and a judge synthesizes. Teach why multiple viewpoints beat one. Encourage trying a real ticker in Chat.",
      ),
      lesson(
        "hc-disagreement-signal",
        "The Disagreement Signal",
        "Conviqt's secret sauce, explained simply.",
        "sharp",
        "Explain Conviqt's disagreement score: when the specialist agents fracture, conviction is low and risk is high. Teach why surfacing disagreement is more honest than a single confident call.",
      ),
      lesson(
        "hc-paper-trading",
        "Why We Paper Trade in Public",
        "Track record with the losers left in.",
        "core",
        "Explain paper trading and why Conviqt's Alpha Tracker publishes every pick — winners AND losers — with entry, stop loss, and outcome. Teach why a public track record builds trust. Bridge to the Alpha page.",
      ),
    ],
  },
  {
    id: "smart-and-safe",
    name: "Smart & Safe",
    tagline: "The street smarts that keep your money yours.",
    emoji: "\u{1F6E1}",
    accent: "#f87171",
    lessons: [
      lesson(
        "ss-scams-fomo",
        "Spotting Scams & FOMO Traps",
        "If it's guaranteed, it's a lie.",
        "starter",
        "Teach a teen to recognize investment scams, pump-and-dump schemes, finfluencer hype, and FOMO-driven decisions. Give concrete red flags and a calm decision rule.",
      ),
      lesson(
        "ss-meme-stocks-crypto",
        "Meme Stocks & Crypto Reality",
        "The honest version nobody on TikTok tells you.",
        "core",
        "Give a balanced, honest take on meme stocks and crypto: the appeal, the extreme volatility, the survivorship bias in success stories, and how to size a 'fun money' bet responsibly.",
      ),
      lesson(
        "ss-emotions-investing",
        "Your Brain Is the Enemy",
        "Beat the panic-sell, FOMO-buy cycle.",
        "sharp",
        "Teach behavioral biases that hurt investors: loss aversion, herd behavior, recency bias, panic selling. Give practical guardrails a young investor can actually use.",
      ),
    ],
  },
];

// ── Lookups ──────────────────────────────────────────────────────────────────

const LESSON_INDEX: Map<string, { lesson: LessonMeta; track: Track }> = (() => {
  const m = new Map<string, { lesson: LessonMeta; track: Track }>();
  for (const track of TRACKS) {
    for (const l of track.lessons) m.set(l.id, { lesson: l, track });
  }
  return m;
})();

export function findLesson(id: string): { lesson: LessonMeta; track: Track } | null {
  return LESSON_INDEX.get(id) ?? null;
}

export const ALL_LESSON_IDS: string[] = [...LESSON_INDEX.keys()];
export const TOTAL_LESSONS = ALL_LESSON_IDS.length;
