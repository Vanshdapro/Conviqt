// Persistence for the market map — reuses the feed_cache table (migration 021).
//
// The Map is the third Lens-trilogy surface on the Dashboard, so it lives in the
// same rolling cache as Dashboard + Headlines under its own key ("feed:map").
// No new table, no new migration: every write OVERWRITES the row for the key,
// exactly the shape feed/store.ts already provides (and the same Currents
// rolling-cache obligation it documents).
//
// We read through deepStripCitations like readDashboard does — the narrative is
// MODELS.lens with NO web_search, so it should never carry <cite …> markup, but
// scrubbing on read is cheap insurance and keeps every feed surface consistent.

import { getFeedStore } from "../feed/store";
import { deepStripCitations } from "../citations";
import type { MarketMap } from "./types";

export const MAP_KEY = "feed:map";

export async function readMarketMap(): Promise<MarketMap | null> {
  const row = await getFeedStore().get<MarketMap>(MAP_KEY);
  // Scrub any web_search <cite …> markup before it reaches the UI (parity with
  // readDashboard — the narrative prose is the only free-text field here).
  return row?.payload ? deepStripCitations(row.payload) : null;
}

export async function writeMarketMap(map: MarketMap): Promise<void> {
  await getFeedStore().set(MAP_KEY, map);
}
