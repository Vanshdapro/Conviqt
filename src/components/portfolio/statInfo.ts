// The teaching layer behind the Portfolio stats strip (playbook Phase 5).
//
// Every stat's ⓘ opens a Sheet that explains the number IN PLAIN ENGLISH,
// reads the user's own value back to them, says exactly how it was computed
// (traceability rule), and hands off to the matching Academy lesson. This is
// the differentiator: the app teaches what its numbers mean.
//
// Client-safe: static copy + pure formatting only. Lesson teasers (title,
// hook) are plucked from the curriculum SERVER-side in page.tsx and passed
// down — importing the curriculum here would drag all 89 lessons into the
// client bundle (same rule as learnLinks.ts).

// Relative import (not "@/...") so the node:test drift suite can load this
// module under tsx without alias resolution.
import {
  MIN_STAT_OBSERVATIONS,
  RISK_FREE_ANNUAL,
} from "../../lib/marketdata/portfolioMath";

export type StatKey = "beta" | "volatility" | "maxDrawdown" | "sharpe";

export const STAT_KEYS: StatKey[] = ["beta", "volatility", "maxDrawdown", "sharpe"];

/** Lesson teaser passed from the server (curriculum stays out of this bundle). */
export interface LessonTeaser {
  lessonId: string;
  title: string;
  hook: string;
  subtitle: string;
}

export type StatLessonMap = Record<StatKey, LessonTeaser>;

/** Academy lesson behind each stat — ids must exist in the curriculum
    (drift-tested in __tests__/statInfo.test.ts). Beta and Sharpe share the
    risk-and-return lesson deliberately: it is the lesson that teaches both,
    and the same mapping learnLinks.ts already uses for those words. */
export const STAT_LESSON_IDS: Record<StatKey, string> = {
  beta: "found-risk-return",
  volatility: "rm-volatility-vs-risk",
  maxDrawdown: "rm-drawdown-math",
  sharpe: "found-risk-return",
};

interface StatInfo {
  label: string;
  /** What this number is, for someone who has never heard the word. */
  what: string;
  /** Exactly how we computed it — every number is traceable. */
  how: string;
  /** Read the user's own value back in plain English. */
  interpret: (value: number) => string;
  format: (value: number) => string;
}

const riskFreePct = (RISK_FREE_ANNUAL * 100).toFixed(1);

export const STAT_INFO: Record<StatKey, StatInfo> = {
  beta: {
    label: "Beta",
    what: "Beta measures how your portfolio tends to move when the overall market moves. A beta of 1 means it swings about as much as the market. Above 1, it amplifies the market's moves — both up and down. Below 1, it's calmer than the market.",
    how: `We compare your portfolio's daily moves to the S&P 500 (via SPY) over the past year of trading days, using your current share counts. At least ${MIN_STAT_OBSERVATIONS} shared sessions are required before we'll show a number.`,
    interpret: (v) => {
      if (v < 0)
        return `Your beta of ${fmt2(v)} is negative — unusual. Your portfolio has tended to move OPPOSITE to the market over the past year.`;
      if (v < 0.8)
        return `Your beta of ${fmt2(v)} means your portfolio has been calmer than the market: when the S&P 500 moves 1%, yours has tended to move about ${fmt2(v)}%.`;
      if (v <= 1.2)
        return `Your beta of ${fmt2(v)} means your portfolio moves roughly in step with the market: a 1% market move has meant about a ${fmt2(v)}% move for you.`;
      return `Your beta of ${fmt2(v)} means your portfolio amplifies the market: when the S&P 500 moves 1%, yours has tended to move about ${fmt2(v)}% — bigger gains on good days, bigger losses on bad ones.`;
    },
    format: fmt2,
  },
  volatility: {
    label: "Volatility",
    what: "Volatility measures how much your portfolio's value swings day to day, expressed as an annual percentage. It says nothing about direction — a portfolio can be volatile on the way up too. For scale: the S&P 500 usually sits around 15–20%, and a single typical stock around 25–40%.",
    how: "We take your portfolio's daily returns over the past year (current share counts × daily closing prices), measure how spread out they are, and annualize using 252 trading days.",
    interpret: (v) => {
      if (v < 12)
        return `At ${fmt1(v)}%, your portfolio has been steadier than the overall market — small daily swings.`;
      if (v < 20)
        return `At ${fmt1(v)}%, your portfolio swings about as much as the overall market typically does.`;
      if (v < 35)
        return `At ${fmt1(v)}%, your portfolio swings noticeably more than the market. Expect bigger day-to-day moves in both directions.`;
      return `At ${fmt1(v)}%, your portfolio is highly volatile — daily swings well beyond what the overall market usually does. Make sure you can stomach the down days.`;
    },
    format: (v) => `${fmt1(v)}%`,
  },
  maxDrawdown: {
    label: "Max Drawdown",
    what: "Max drawdown is the worst peak-to-trough fall your portfolio took over the period — the deepest 'how far did it sink before it stopped sinking' moment. Losses are asymmetric: a 30% fall needs a 43% gain just to get back to even, which is why deep drawdowns matter more than they look.",
    how: "We build your portfolio's daily value over the past year from your current share counts and each day's closing prices, then find the largest drop from any high point to the low that followed it.",
    interpret: (v) => {
      const recovery = v < 100 ? (100 * v) / (100 - v) : Infinity;
      const rec = Number.isFinite(recovery) ? `${fmt1(recovery)}%` : "an impossible";
      if (v < 10)
        return `Your worst slide of the year was ${fmt1(v)}% — shallow. A ${rec} gain gets back to even from there.`;
      if (v < 20)
        return `Your worst slide of the year was ${fmt1(v)}% — moderate. It takes a ${rec} gain to recover a fall like that.`;
      if (v < 35)
        return `Your worst slide of the year was ${fmt1(v)}% — deep. It takes a ${rec} gain just to get back to even, which is the hidden tax of big losses.`;
      return `Your worst slide of the year was ${fmt1(v)}% — severe. From a fall that deep it takes a ${rec} gain just to break even.`;
    },
    format: (v) => `−${fmt1(v)}%`,
  },
  sharpe: {
    label: "Sharpe",
    what: `The Sharpe ratio asks: for the swings you put up with, how much return did you actually get? It compares your return above a risk-free ${riskFreePct}% (what cash-like Treasuries pay) to your volatility. Higher is better; below zero means cash would have paid more.`,
    how: `Your portfolio's annualized daily return over the past year, minus a ${riskFreePct}% risk-free rate, divided by its annualized volatility — the standard after-the-fact Sharpe ratio.`,
    interpret: (v) => {
      if (v < 0)
        return `Your Sharpe of ${fmt2(v)} is negative: over the past year, the risk you carried wasn't paid for — a risk-free ${riskFreePct}% would have done better.`;
      if (v < 0.5)
        return `Your Sharpe of ${fmt2(v)} is on the weak side: you earned a bit more than risk-free, but took meaningful swings to get it.`;
      if (v < 1)
        return `Your Sharpe of ${fmt2(v)} is respectable: you were reasonably paid for the swings you took.`;
      return `Your Sharpe of ${fmt2(v)} is strong: over the past year you earned well above the risk-free rate for each unit of risk you carried.`;
    },
    format: fmt2,
  },
};

function fmt2(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmt1(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
