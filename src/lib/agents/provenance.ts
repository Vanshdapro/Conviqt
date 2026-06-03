// Citation provenance helpers shared by Alpha-pipeline agents that touch the
// open web (currently the mosaic scan). The integrity rule (CLAUDE.md): every
// cited fact must trace back to a URL Anthropic actually surfaced via a
// web_search_tool_result block — model-invented URLs are dropped, and any fact
// citing a dropped URL is dropped with it.
//
// sweep.ts keeps its own private copy of this logic so we don't perturb the
// shared chat path; this module exists so the mosaic agent inherits the exact
// same guarantee without duplicating it again.

import { normalizeUrl, hostOf } from "../url-normalize";
import type { AlphaPickSource } from "../alphaTypes";

// A content block from an Anthropic messages response. Loosely typed — we only
// inspect a few fields across the union of block shapes.
export interface ContentBlockLike {
  type: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

interface WebSearchResultLike {
  url?: string;
  title?: string;
  type?: string;
}

// Extract the canonical set of URLs Anthropic surfaced via
// web_search_tool_result blocks, keyed by normalized URL. The source of truth
// every cited fact must match.
export function extractCanonicalUrls(
  content: ContentBlockLike[]
): Map<string, { url: string; title: string }> {
  const map = new Map<string, { url: string; title: string }>();
  for (const block of content) {
    if (block.type !== "web_search_tool_result") continue;
    const inner = block.content;
    if (!Array.isArray(inner)) continue;
    for (const result of inner as WebSearchResultLike[]) {
      if (result.type !== "web_search_result") continue;
      if (typeof result.url !== "string") continue;
      const norm = normalizeUrl(result.url);
      if (!norm) continue;
      if (!map.has(norm)) {
        map.set(norm, {
          url: result.url,
          title: typeof result.title === "string" ? result.title : result.url,
        });
      }
    }
  }
  return map;
}

export interface ModelSource {
  url: string;
  title?: string;
  publisher?: string;
}

export interface ResolvedSources {
  sources: AlphaPickSource[];
  // old model-source index → new validated index. A citation to an index NOT
  // present here was rejected, and the citing item should be dropped.
  indexRemap: Map<number, number>;
  rejected: number;
}

// Validate a model's self-reported source list against the canonical
// web_search URLs. Drops invented sources and returns an index remap so callers
// can drop facts/factors that cited a rejected source. Mirrors the proven
// validation in sweep.ts.
export function resolveCitedSources(
  modelSources: ModelSource[],
  canonical: Map<string, { url: string; title: string }>
): ResolvedSources {
  const sources: AlphaPickSource[] = [];
  const indexRemap = new Map<number, number>();
  let rejected = 0;
  for (let i = 0; i < modelSources.length; i++) {
    const s = modelSources[i];
    const norm = normalizeUrl(s?.url ?? "");
    if (!norm || !canonical.has(norm)) {
      rejected += 1;
      continue;
    }
    const canon = canonical.get(norm)!;
    indexRemap.set(i, sources.length);
    sources.push({
      url: canon.url, // prefer the original URL Anthropic returned
      title: (s.title?.trim() || canon.title || canon.url).slice(0, 200),
      publisher: (s.publisher?.trim() || hostOf(canon.url) || "Unknown").slice(0, 80),
    });
  }
  return { sources, indexRemap, rejected };
}
