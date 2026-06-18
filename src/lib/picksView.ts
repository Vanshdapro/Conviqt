// The public track record, shaped for rendering — shared by the Dashboard
// Picks section and the landing page's TRACK RECORD section so the two can
// never drift apart. Live P/L comes from the marketdata layer's shared
// 15-minute cache; when no source answers, we fall back to the pipeline's
// last stored snapshot, honestly dated. Never a guessed number.

import { quote } from "@/lib/marketdata";
import { getAlphaStore } from "@/lib/alphaStore";
import type { AlphaPick } from "@/lib/alphaTypes";
import { stripCitationTags } from "@/lib/citations";

export interface PickView {
  pick: AlphaPick;
  open: boolean;
  /** % return — live for open picks, realized for closed. null = unavailable. */
  returnPct: number | null;
  /** Current/exit price backing returnPct. */
  price: number | null;
  /** When the price is a stored snapshot, the date it was taken. */
  priceAsOfNote: string | null;
}

/**
 * `live: true` (Dashboard) prices open picks through the marketdata layer
 * (15-min shared cache), falling back to the pipeline's stored snapshot.
 * `live: false` (landing page) uses the stored snapshot only — quote()'s
 * no-store fetches would force the whole route dynamic, and the landing must
 * stay statically generated (ISR). The snapshot is always honestly dated.
 */
export async function loadPicks({ live = true }: { live?: boolean } = {}): Promise<PickView[]> {
  const store = getAlphaStore();
  const [active, sold] = await Promise.all([
    store.fetchActive(),
    store.fetchRecentlySold(3650), // full history — losses included
  ]);

  const openViews = await Promise.all(
    active.map(async (pick): Promise<PickView> => {
      const q = live ? await quote(pick.ticker) : null;
      if (q) {
        return {
          pick,
          open: true,
          returnPct: ((q.price - pick.entry_price) / pick.entry_price) * 100,
          price: q.price,
          priceAsOfNote: null,
        };
      }
      // Live quote unavailable (or not requested) — the pipeline's last
      // snapshot, honestly dated. Never a guessed number.
      if (pick.current_price && pick.price_change_pct !== null && pick.price_change_pct !== undefined) {
        return {
          pick,
          open: true,
          returnPct: pick.price_change_pct,
          price: pick.current_price,
          priceAsOfNote: pick.price_last_updated
            ? `as of ${pick.price_last_updated.slice(0, 10)}`
            : "last check",
        };
      }
      return { pick, open: true, returnPct: null, price: null, priceAsOfNote: null };
    })
  );

  const soldViews = sold.map((pick): PickView => {
    const realized =
      pick.realized_return_pct ??
      (pick.exit_price ? ((pick.exit_price - pick.entry_price) / pick.entry_price) * 100 : null);
    return {
      pick,
      open: false,
      returnPct: realized,
      price: pick.exit_price ?? null,
      priceAsOfNote: null,
    };
  });

  openViews.sort((a, b) => (b.pick.entry_date || "").localeCompare(a.pick.entry_date || ""));
  soldViews.sort((a, b) => (b.pick.exit_date || "").localeCompare(a.pick.exit_date || ""));
  return [...openViews, ...soldViews];
}

export interface PickStats {
  winRate: number;
  /**
   * CUMULATIVE return — each pick's % result summed together (founder's chosen
   * metric: "add it to the total and aggregate it; the return is not per stock").
   * This is NOT an average and NOT the return on a fixed dollar investment, so
   * the UI must label it as a combined/cumulative figure, never imply portfolio ROI.
   */
  totalReturn: number;
  total: number;
  open: number;
}

export function pickStats(views: PickView[]): PickStats | null {
  const scored = views.filter((v) => v.returnPct !== null);
  if (scored.length === 0) return null;
  const wins = scored.filter((v) => (v.returnPct as number) > 0).length;
  // Sum, not average — this is the cumulative result across every pick.
  const totalReturn = scored.reduce((s, v) => s + (v.returnPct as number), 0);
  const open = views.filter((v) => v.open).length;
  return {
    winRate: Math.round((wins / scored.length) * 100),
    totalReturn: Math.round(totalReturn * 10) / 10,
    total: views.length,
    open,
  };
}

export function thesisLine(pick: AlphaPick): string {
  const line = stripCitationTags(pick.bull_thesis || pick.catalyst || "")
    .trim()
    .replace(/\s+/g, " ");
  return line.length > 150 ? `${line.slice(0, 149)}…` : line;
}
