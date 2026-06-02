// HTML/text builder for the watchlist alert digest email (Deliverable 3).
//
// One email per user per cron run, listing every triggered ticker. Each card
// deep-links to /stock/[ticker], which already renders the free verdict summary
// with a paid "unlock full debate + sources" gate — that page IS the conversion
// surface, so the email just has to get the user there at the right moment.
//
// Editorial dark theme to match the app. Inline styles only (email clients
// strip <style> and class selectors).

export type WatchlistAlertKind = "earnings" | "disagreement";

export interface WatchlistAlertCard {
  ticker: string;
  companyName: string | null;
  kind: WatchlistAlertKind;
  verdict: string | null; // BUY/HOLD/SELL
  conviction: number | null; // 0-10 scale shown to user
  disagreement: number | null; // 0-100
  earningsDate: string | null; // ISO date for earnings alerts
  hoursToEarnings: number | null;
}

const BASE = "https://www.conviqt.com";
const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const CARD_BG = "#0c1524";
const PAGE_BG = "#070b12";
const RULE = "rgba(232,237,248,0.10)";

function verdictColor(v: string | null): string {
  if (v === "BUY") return "#34d399";
  if (v === "SELL") return "#f87171";
  return "#f59e0b"; // HOLD / unknown
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00Z" : "")).toLocaleDateString(
      "en-US",
      { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }
    );
  } catch {
    return iso;
  }
}

function convictionLabel(c: number | null): string {
  if (c === null) return "—";
  return `${Math.round(c / 10)}/10`;
}

function headline(card: WatchlistAlertCard): string {
  const name = card.companyName || card.ticker;
  if (card.kind === "earnings") {
    const when =
      card.hoursToEarnings !== null && card.hoursToEarnings <= 28
        ? "reports earnings tomorrow"
        : "reports earnings in the next 48 hours";
    return `${card.ticker} ${when}.`;
  }
  return `The Council just fractured on ${name}.`;
}

function subline(card: WatchlistAlertCard): string {
  const v = card.verdict ?? "HOLD";
  if (card.kind === "earnings") {
    return `Current verdict: <strong style="color:${verdictColor(card.verdict)}">${v}</strong> (${convictionLabel(
      card.conviction
    )} conviction). Read the bear case before they report.`;
  }
  return `Verdict <strong style="color:${verdictColor(card.verdict)}">${v}</strong> with ${
    card.disagreement ?? 0
  }% disagreement across the panel — the agents don't agree. See where they split.`;
}

function cardHtml(card: WatchlistAlertCard): string {
  const url = `${BASE}/stock/${encodeURIComponent(card.ticker)}?utm_source=alert&utm_medium=email&utm_campaign=watchlist`;
  const tag =
    card.kind === "earnings"
      ? `EARNINGS · ${fmtDate(card.earningsDate)}`
      : `HIGH DISAGREEMENT · ${card.disagreement}%`;
  return `
  <tr><td style="padding:0 0 14px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${CARD_BG};border:1px solid ${RULE};border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${ACCENT};margin-bottom:12px;">${tag}</div>
        <div style="font-family:Georgia,serif;font-size:20px;line-height:1.3;color:${INK};margin-bottom:8px;">${headline(card)}</div>
        <div style="font-family:Georgia,serif;font-size:15px;line-height:1.55;color:${MUTED};margin-bottom:18px;">${subline(card)}</div>
        <a href="${url}" style="display:inline-block;background:${ACCENT};color:#06101f;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.02em;text-decoration:none;padding:11px 22px;border-radius:100px;">
          ${card.kind === "earnings" ? "See the Council brief →" : "See where they split →"}
        </a>
      </td></tr>
    </table>
  </td></tr>`;
}

export interface BuildEmailResult {
  subject: string;
  html: string;
  text: string;
}

export function buildWatchlistEmail(
  email: string,
  cards: WatchlistAlertCard[]
): BuildEmailResult {
  const earningsCount = cards.filter((c) => c.kind === "earnings").length;

  let subject: string;
  if (cards.length === 1) {
    const c = cards[0];
    subject =
      c.kind === "earnings"
        ? `${c.ticker} reports earnings soon — the Council's verdict before the call`
        : `${c.ticker}: the Council is split — see the bear case`;
  } else if (earningsCount > 0) {
    subject = `${cards.length} watchlist alerts — ${earningsCount} earnings this week`;
  } else {
    subject = `${cards.length} of your watched tickers just moved the Council`;
  }

  const cardsHtml = cards.map(cardHtml).join("");
  const unsubUrl = `${BASE}/watchlist?utm_source=alert&utm_medium=email`;

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE_BG};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${PAGE_BG};padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;margin:0 auto;padding:0 16px;">
        <tr><td style="padding:0 0 24px;">
          <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.22em;text-transform:uppercase;color:${INK};">CONVIQT</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:${FAINT};margin-top:6px;">Watchlist alert · ${fmtDate(
            new Date().toISOString()
          )}</div>
        </td></tr>
        ${cardsHtml}
        <tr><td style="padding:20px 4px 0;border-top:1px solid ${RULE};">
          <div style="font-family:Georgia,serif;font-size:12px;line-height:1.6;color:${FAINT};">
            You're getting this because these tickers are on your Conviqt watchlist.
            Verdicts are AI-generated analysis, not personalized financial advice — every number on the report links to its source.
            <br><br>
            <a href="${unsubUrl}" style="color:${MUTED};">Manage your watchlist →</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `CONVIQT — Watchlist alert`,
    ``,
    ...cards.map((c) => {
      const url = `${BASE}/stock/${encodeURIComponent(c.ticker)}`;
      return `• ${headline(c).replace(/<[^>]+>/g, "")}\n  Verdict ${c.verdict ?? "HOLD"} · ${url}`;
    }),
    ``,
    `Manage your watchlist: ${unsubUrl}`,
    `AI-generated analysis, not personalized financial advice.`,
  ].join("\n");

  return { subject, html, text };
}
