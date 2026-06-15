// Citation-tag scrubbing.
//
// When Claude runs web_search it sometimes wraps cited claims in inline
// `<cite index="4-3,17-5">…</cite>` markup — even *inside* the string values of
// a structured tool_use result (e.g. a Headline Decoder `summary`). That markup
// is internal plumbing: Conviqt surfaces provenance separately (the collapsed
// "Sources" accordion + the provenance validator), so the tags are pure noise.
// Leaking a literal "<cite index=…>" into rendered copy looks broken and wrecks
// credibility, so we strip the wrapper everywhere while KEEPING the cited text.
//
// Defence in depth — we scrub in three places:
//   1. at generation (the AI adapter, openai.ts) so nothing dirty is ever cached;
//   2. at cache read (report/feed stores) so already-cached dirty rows clean up
//      without a cache bust;
//   3. at render (answers.tsx `stripCites`) as a last line of defence.

// Matches an opening `<cite …>` OR a closing `</cite>` tag. `\b` keeps it from
// eating an unrelated tag that merely starts with "cite". Attribute soup
// (`index="4-3,17-5"`) is swallowed by `[^>]*`. Inner text is preserved.
const CITE_TAG_RE = /<\/?cite\b[^>]*>/gi;

/**
 * Remove Claude web_search `<cite …>`/`</cite>` markup from a string, keeping
 * the cited text. Tidies up the whitespace the removal leaves behind. Returns
 * the input unchanged when there's no `<` at all (the overwhelmingly common
 * case), so clean prose is never touched.
 */
export function stripCitationTags(text: string): string {
  if (!text || text.indexOf("<") === -1) return text;
  return text
    .replace(CITE_TAG_RE, "")
    // a removed tag can leave "word  word" or "word ." — tidy both.
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,;:!?)])/g, "$1")
    .replace(/(\()[ \t]+/g, "$1");
}

/**
 * Recursively scrub citation tags from every string in an object/array,
 * preserving shape. Used at cache-read chokepoints to clean structured report
 * payloads (CompareResult, CouncilResult, feed content, …) in one pass.
 */
export function deepStripCitations<T>(value: T): T {
  if (typeof value === "string") {
    return stripCitationTags(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => deepStripCitations(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepStripCitations(v);
    }
    return out as T;
  }
  return value;
}
