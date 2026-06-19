// Conviction / confidence / disagreement are INTERNAL 0-100 scores (see
// src/lib/agents/types.ts, and the judge prompt: "never quote internal N/100
// scores"). Users only ever see the plain qualitative band — CLAUDE.md:
// "Conviction is shown as 'How sure: High/Medium/Low' — never a raw score."
// This module is the single place that maps an internal 0-100 score to the
// words the UI is allowed to show.

export type Sureness = "High" | "Medium" | "Low";

/**
 * Conviction / confidence (0-100) → the "How sure" band.
 * Thresholds mirror howSure() in components/research/answers.tsx and
 * sureLabel() in lib/watchlistEmail.ts so every surface agrees.
 */
export function howSure(score: number): Sureness {
  if (score >= 70) return "High";
  if (score >= 45) return "Medium";
  return "Low";
}

/**
 * Disagreement / dispersion (0-100) → plain word for how split the analysts
 * are. Mirrors dispersionLabel() in components/SectorReport.tsx.
 */
export type Dispersion = "aligned" | "leaning" | "split" | "fractured";
export function dispersionWord(d: number): Dispersion {
  if (d >= 60) return "fractured";
  if (d >= 35) return "split";
  if (d >= 15) return "leaning";
  return "aligned";
}
