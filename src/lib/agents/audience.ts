// The ONE system-prompt switch for answer language complexity (Phase 7).
//
// Onboarding stores an experience level on the user profile; every pipeline
// that writes user-facing prose (Council judge, Flash judge, Face-Off,
// Sector Pulse, Headline Decoder, the general analyst, Health Check, Starter
// Portfolio) appends `audienceDirective(level)` to its system prompt.
//
// "new" is the product default — CLAUDE.md already targets a 19-year-old with
// $500, so the base prompts explain everything. That's why "new" (and an
// unknown level) returns null: no extra block, no cache-key change, identical
// behavior to today. Only "learning" and "experienced" shift the dial.
//
// Prompt-cache note: append the directive as a SECOND system block, AFTER the
// block carrying cache_control — the cached prefix stays byte-identical and
// keeps hitting regardless of the reader's level.

export type ExperienceLevel = "new" | "learning" | "experienced";

const DIRECTIVES: Record<ExperienceLevel, string | null> = {
  // Base prompts already write for a complete beginner.
  new: null,
  learning:
    "READER LEVEL: this reader knows the basics — what a stock, an index, and a P/E ratio are. " +
    "Keep the plain-English voice, but don't pause to define beginner terms; only briefly explain " +
    "genuinely advanced concepts the first time they appear.",
  experienced:
    "READER LEVEL: this reader is an experienced retail investor. Be direct and information-dense; " +
    "standard finance vocabulary (multiples, beta, drawdown, guidance) needs no explanation. " +
    "Still plain English — never jargon for its own sake, and every claim stays sourced.",
};

/**
 * The extra system block for this reader, or null when the base prompt is
 * already right (new / unknown).
 */
export function audienceDirective(level: ExperienceLevel | null | undefined): string | null {
  if (!level) return null;
  return DIRECTIVES[level] ?? null;
}

/**
 * Cache-key suffix so personalized runs never collide with the shared default.
 * "" for new/unknown keeps every existing cache entry valid.
 */
export function audienceCacheSuffix(level: ExperienceLevel | null | undefined): string {
  return audienceDirective(level) ? `:aud_${level}` : "";
}
