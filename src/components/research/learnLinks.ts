// "Learn why →" — maps concepts that appear in answer prose to Academy
// lessons (playbook 2.2: lessons are deep-linked from analysis answers).
//
// Client-safe data + matcher. Lesson ids are the permanent keys from
// src/lib/learn (never renumbered), so a match deep-links to
// /academy/learn?lesson=<id>. Titles mirror the real lesson titles so the
// chip promises exactly what the lesson delivers.

export interface LearnLink {
  lessonId: string;
  title: string;
}

interface ConceptRule {
  pattern: RegExp;
  lessonId: string;
  title: string;
}

// Ordered roughly by how decision-relevant the concept is in answers; the
// matcher walks the answer text once per rule and keeps the first `max` hits.
// Exported for the drift test (__tests__/learnLinks.test.ts) that asserts
// every lessonId still exists in the curriculum — do NOT import the
// curriculum here: this module is client-bundled and the curriculum drags in
// all 89 lessons of content.
export const CONCEPT_RULES: ConceptRule[] = [
  { pattern: /\bP\/E\b|price[- ]to[- ]earnings|valuation multiple|\bmultiple of\b|trades? at \d+x|forward multiple/i, lessonId: "vq-multiples", title: "Multiples: The Shorthand" },
  { pattern: /\bmoat\b|competitive advantage|pricing power|switching costs|network effect/i, lessonId: "vq-moats", title: "Moats: What Protects Returns" },
  { pattern: /margin of safety|priced for perfection|little room for error/i, lessonId: "vq-margin-of-safety", title: "Margin of Safety" },
  { pattern: /\bmargins?\b.{0,24}(expand|compress|pressure|improve)|gross margin|operating margin|net margin/i, lessonId: "fa-margins", title: "Margins: Gross to Net" },
  { pattern: /\bROIC\b|return on invested capital|compounding machine/i, lessonId: "vq-roic-compounding", title: "ROIC & the Compounding Machine" },
  { pattern: /discounted cash flow|\bDCF\b|intrinsic value/i, lessonId: "vq-dcf-basics", title: "DCF: Where Value Comes From" },
  { pattern: /revenue growth|growth (is )?(slowing|accelerating|decelerating)|top-?line growth/i, lessonId: "fa-good-vs-bad-growth", title: "Good Growth vs Bad Growth" },
  { pattern: /\bdebt\b|leverage|balance sheet|interest coverage|borrowings/i, lessonId: "fa-leverage-coverage", title: "Leverage & Coverage" },
  { pattern: /free cash flow|cash flow|\bFCF\b|cash generation/i, lessonId: "fs-cash-flow", title: "The Cash Flow Statement" },
  { pattern: /earnings quality|accruals|one-time items|non-GAAP/i, lessonId: "fs-accruals", title: "Accruals vs Cash" },
  { pattern: /interest rates?|rate cuts?|rate hikes?|the Fed\b|federal reserve|monetary policy/i, lessonId: "mr-rates-gravity", title: "Rates Are Gravity" },
  { pattern: /inflation|\bCPI\b|purchasing power/i, lessonId: "mr-inflation-real-returns", title: "Inflation & Real Returns" },
  { pattern: /yield curve|recession signal|inverted curve/i, lessonId: "mr-yield-curve", title: "The Yield Curve" },
  { pattern: /sentiment (is )?(stretched|extreme|euphoric|washed out)|euphoria|capitulation|fear and greed|contrarian/i, lessonId: "mr-sentiment-extremes", title: "Sentiment Extremes & Contrarianism" },
  { pattern: /\bFOMO\b|chasing the rally|recency bias|momentum crowd/i, lessonId: "bf-recency-fomo", title: "Recency Bias & FOMO" },
  { pattern: /herd(ing)?|crowded trade|everyone (is )?(buying|selling|piling)/i, lessonId: "bf-herding", title: "Herding & Social Proof" },
  { pattern: /short interest|short sellers?|short squeeze|heavily shorted/i, lessonId: "mkt-short-selling", title: "Short Selling" },
  { pattern: /implied volatility|options market|\bIV\b|options pricing/i, lessonId: "mkt-implied-volatility", title: "Implied Volatility" },
  { pattern: /support|resistance|entry (point|level|zone)|exit (point|level|zone)|limit order|stop[- ]loss/i, lessonId: "mkt-order-types", title: "Market vs Limit Orders" },
  { pattern: /volatility|volatile|big swings|choppy/i, lessonId: "rm-volatility-vs-risk", title: "Volatility Is Not Risk" },
  { pattern: /drawdown|peak[- ]to[- ]trough|recover(y|ing) from losses/i, lessonId: "rm-drawdown-math", title: "The Recovery Tax" },
  { pattern: /tail risk|black swan|worst[- ]case scenario|left tail/i, lessonId: "rm-tail-risk", title: "Tail Risk & Black Swans" },
  { pattern: /diversif|concentrat(ed|ion)|correlation|all your eggs/i, lessonId: "ps-correlation-diversification", title: "Correlation, Not Count" },
  { pattern: /position siz(e|ing)|how much to (buy|invest|put in)|allocation siz/i, lessonId: "ps-sizing-beats-picking", title: "Why Sizing Beats Picking" },
  { pattern: /base rate|historically,? (most|few)|outside view/i, lessonId: "mm-base-rates", title: "Base Rates & the Outside View" },
  { pattern: /expected value|probability[- ]weighted|risk[- ]reward|asymmetr/i, lessonId: "mm-expected-value", title: "Thinking in Bets & Expected Value" },
  { pattern: /dollar[- ]cost averag|\bSIP\b|monthly (contribution|investing)|invest(ing)? a fixed amount/i, lessonId: "found-dca", title: "Dollar-Cost Averaging" },
  { pattern: /\bETFs?\b|index funds?|tracks? (the |an? )?index/i, lessonId: "mkt-etfs", title: "ETFs & How They Trade" },
  { pattern: /compound(ing|s)?|long[- ]run returns|years of growth/i, lessonId: "found-compounding", title: "The Magic of Compounding" },
  { pattern: /risk[- ]free|treasur(y|ies)|risk (and|vs\.?) return|\bbeta\b|\bSharpe\b/i, lessonId: "found-risk-return", title: "Risk and Return" },
  { pattern: /unit economics|\bLTV\b|\bCAC\b|customer acquisition/i, lessonId: "fa-unit-economics", title: "Unit Economics: LTV & CAC" },
  { pattern: /earnings yield|stocks vs bonds/i, lessonId: "vq-earnings-yield", title: "Earnings Yield & the Fed Model" },
];

/** Lesson deep-link href (LearnDashboard opens the lesson from this param). */
export function lessonHref(lessonId: string): string {
  return `/academy/learn?lesson=${encodeURIComponent(lessonId)}`;
}

/**
 * Scan answer prose for known concepts and return up to `max` lesson links,
 * deduped by lesson, in rule-priority order.
 */
export function learnLinksFor(text: string, max = 4): LearnLink[] {
  const links: LearnLink[] = [];
  const seen = new Set<string>();
  for (const rule of CONCEPT_RULES) {
    if (links.length >= max) break;
    if (seen.has(rule.lessonId)) continue;
    if (rule.pattern.test(text)) {
      seen.add(rule.lessonId);
      links.push({ lessonId: rule.lessonId, title: rule.title });
    }
  }
  return links;
}
