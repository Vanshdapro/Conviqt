// URL normalization for citation provenance matching.
//
// Used by sweep + picker to match the model's self-reported source list
// against the canonical web_search_tool_result blocks. We can't compare
// raw strings because the model paraphrases query params and casing.
//
// Normalization rules:
// - lowercase host
// - strip default ports
// - strip trailing slash on path
// - strip fragment (#)
// - strip noisy tracking params (utm_*, gclid, fbclid)
// - keep query params otherwise (some article URLs depend on ?id=...)

const NOISE_PARAM_PREFIXES = ["utm_", "_ga", "gclid", "fbclid", "ref_"];

export function normalizeUrl(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    // strip noisy params
    const keep: [string, string][] = [];
    u.searchParams.forEach((v, k) => {
      const low = k.toLowerCase();
      if (NOISE_PARAM_PREFIXES.some((p) => low.startsWith(p))) return;
      keep.push([k, v]);
    });
    // rebuild search
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);
    let path = u.pathname.replace(/\/+$/, "");
    if (path === "") path = "/";
    u.pathname = path;
    const host = u.host.toLowerCase();
    const search = u.search;
    return `${u.protocol}//${host}${path}${search}`;
  } catch {
    return null;
  }
}

export function hostOf(input: string): string | null {
  try {
    return new URL(input).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
