import { NextResponse } from "next/server";
import { quote } from "@/lib/marketdata";
import { readHeadlines } from "@/lib/feed/store";
import { getFeedRegion } from "@/lib/feed/types";

// GET /api/headlines?region=us
//
// Serves one region's cached edition (written by /api/feed/refresh) plus
// live prices for the ticker chips. Public read — the feed is globally
// shared content, the same for every user. Quotes come from the marketdata
// layer's shared 15-minute cache, so a busy tab costs the free feeds nothing
// extra.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const regionId = new URL(req.url).searchParams.get("region") ?? "us";
  const region = getFeedRegion(regionId);
  if (!region) {
    return NextResponse.json({ error: `Unknown region "${regionId}"` }, { status: 400 });
  }

  try {
    const edition = await readHeadlines(region.id);
    if (!edition) {
      // Honest empty state: nothing cached yet (first deploy, or the region
      // has never produced a publishable edition).
      return NextResponse.json({ region: region.id, headlines: [], generatedAt: null, quotes: {} });
    }

    // Live prices for every ticker chip in the edition, deduped. null quote =
    // the chip renders without a price — never a synthetic number.
    const tickers = [...new Set(edition.headlines.flatMap((h) => h.tickers))];
    const quotes: Record<string, { price: number; changePct: number | null } | null> = {};
    await Promise.all(
      tickers.map(async (t) => {
        const q = await quote(t);
        quotes[t] = q ? { price: q.price, changePct: q.changePct } : null;
      })
    );

    return NextResponse.json({
      region: edition.region,
      headlines: edition.headlines,
      generatedAt: edition.generatedAt,
      quotes,
    });
  } catch (err) {
    console.error(`[feed] /api/headlines ${region.id} failed:`, err);
    return NextResponse.json({ error: "Headlines are unavailable right now." }, { status: 500 });
  }
}
