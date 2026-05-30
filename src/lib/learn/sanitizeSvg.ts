// Server-side SVG sanitizer for Claude-authored lesson infographics.
//
// The hero infographic is the one place a lesson contains model-authored markup.
// Even though the content originates from our own trusted Claude call (not user
// input), we sanitize defense-in-depth before it is rendered with
// dangerouslySetInnerHTML on the client:
//   - allowlist of presentational SVG tags only (no <script>, <foreignObject>)
//   - strip every on* event-handler attribute
//   - strip href/xlink:href values that aren't plain http(s) or # fragments
//   - cap total length so a runaway generation can't bloat the payload
//
// This is a conservative regex/string sanitizer — not a full DOM parser — which
// is appropriate here because the input is small, trusted-origin SVG.

const ALLOWED_TAGS = new Set([
  "svg", "g", "defs", "title", "desc",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textpath",
  "linecanvas", // tolerated typo guard — dropped if present
  "lineargradient", "radialgradient", "stop",
  "clippath", "mask", "pattern", "use", "symbol", "marker",
]);

const MAX_SVG_LENGTH = 24_000;

export function sanitizeSvg(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";

  let svg = raw.trim();

  // Must actually be an <svg> root. Pull out the first <svg>...</svg> block.
  const match = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return "";
  svg = match[0];

  // Remove comments, CDATA, DOCTYPE, processing instructions.
  svg = svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "")
    .replace(/<\?[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  // Drop disallowed elements entirely (including their content for script-like tags).
  svg = svg.replace(
    /<(script|style|foreignObject|iframe|image|audio|video|animate\w*|set)\b[\s\S]*?<\/\1>/gi,
    "",
  );
  // Self-closing variants of the same.
  svg = svg.replace(
    /<(script|style|foreignObject|iframe|image|audio|video|animate\w*|set)\b[^>]*\/?>/gi,
    "",
  );

  // Strip on* event handler attributes (onclick, onload, onmouseover, ...).
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Neutralize javascript:/data:text in any href / xlink:href.
  svg = svg.replace(
    /\s(xlink:href|href)\s*=\s*("[^"]*"|'[^']*')/gi,
    (full, attr, val) => {
      const inner = val.slice(1, -1).trim().toLowerCase();
      if (inner.startsWith("#") || inner.startsWith("http://") || inner.startsWith("https://")) {
        return full;
      }
      return ""; // drop unsafe (javascript:, data:, etc.)
    },
  );

  // Drop any remaining tag whose name isn't in the allowlist.
  svg = svg.replace(/<\/?([a-z][a-z0-9:]*)\b[^>]*>/gi, (tag, name: string) => {
    const lower = name.toLowerCase().replace(/^.*:/, ""); // ignore namespace prefix
    return ALLOWED_TAGS.has(lower) || ALLOWED_TAGS.has(name.toLowerCase()) ? tag : "";
  });

  if (svg.length > MAX_SVG_LENGTH) return "";

  // Guarantee a viewBox-friendly responsive root: ensure width/height don't force overflow.
  svg = svg.replace(
    /<svg\b([^>]*)>/i,
    (m, attrs: string) => {
      let a = attrs;
      if (!/viewBox=/i.test(a) && /width=|height=/i.test(a)) {
        // best-effort: leave as-is if no viewBox; the renderer wraps it responsively
      }
      // Force max-width styling via a style attribute merge.
      if (/style=/i.test(a)) {
        a = a.replace(/style=("|')(.*?)\1/i, (sm, q, body) => `style=${q}${body};max-width:100%;height:auto${q}`);
      } else {
        a = `${a} style="max-width:100%;height:auto"`;
      }
      return `<svg${a}>`;
    },
  );

  return svg.trim();
}
