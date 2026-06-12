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
  conviction: number | null; // 0-100; rendered qualitatively, never as a raw number
  disagreement: number | null; // 0-100 (internal trigger only — never rendered to the reader)
  earningsDate: string | null; // ISO date for earnings alerts
  hoursToEarnings: number | null;
}

const BASE = "https://www.conviqt.com";
const INK = "#2A1C15";
const MUTED = "#63372C";
const FAINT = "#7A6A5A";
const ACCENT = "#0E7978";
const CARD_BG = "#FCFAF5";
const PAGE_BG = "#F5EFE1";
const RULE = "#DED2B8";

function verdictColor(v: string | null): string {
  if (v === "BUY") return "#0A6F79";
  if (v === "SELL") return "#AF4138";
  return "#63372C"; // HOLD / unknown
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

// Conviction renders as plain "How sure" — High/Medium/Low, never a raw
// number (CLAUDE.md: "Conviction is shown as 'How sure: High/Medium/Low' —
// never a raw score"). Thresholds mirror howSure() in
// components/research/answers.tsx; both read the same 0-100 scale.
function sureLabel(c: number | null): string {
  if (c === null) return "—";
  if (c >= 70) return "High";
  if (c >= 45) return "Medium";
  return "Low";
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
  return `Your analysts just split on ${name}.`;
}

function subline(card: WatchlistAlertCard): string {
  const v = card.verdict ?? "HOLD";
  if (card.kind === "earnings") {
    return `Current verdict: <strong style="color:${verdictColor(card.verdict)}">${v}</strong> (how sure: ${sureLabel(
      card.conviction
    )}). Read the bear case before they report.`;
  }
  return `Verdict <strong style="color:${verdictColor(
    card.verdict
  )}">${v}</strong>, but your analysts don't line up on this one — see where they split.`;
}

function cardHtml(card: WatchlistAlertCard): string {
  const url = `${BASE}/stock/${encodeURIComponent(card.ticker)}?utm_source=alert&utm_medium=email&utm_campaign=watchlist`;
  const tag =
    card.kind === "earnings"
      ? `EARNINGS · ${fmtDate(card.earningsDate)}`
      : `ANALYSTS SPLIT`;
  return `
  <tr><td style="padding:0 0 14px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${CARD_BG};border:1px solid ${RULE};border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${ACCENT};margin-bottom:12px;">${tag}</div>
        <div style="font-family:Georgia,serif;font-size:20px;line-height:1.3;color:${INK};margin-bottom:8px;">${headline(card)}</div>
        <div style="font-family:Georgia,serif;font-size:15px;line-height:1.55;color:${MUTED};margin-bottom:18px;">${subline(card)}</div>
        <a href="${url}" style="display:inline-block;background:${ACCENT};color:#FCFAF5;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.02em;text-decoration:none;padding:11px 22px;border-radius:100px;">
          ${card.kind === "earnings" ? "See the full read →" : "See where they split →"}
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
        ? `${c.ticker} reports earnings soon — your analysts' verdict before the call`
        : `${c.ticker}: your analysts are split — see the bear case`;
  } else if (earningsCount > 0) {
    subject = `${cards.length} watchlist alerts — ${earningsCount} earnings this week`;
  } else {
    subject = `${cards.length} of your watched tickers just split the analysts`;
  }

  const cardsHtml = cards.map(cardHtml).join("");
  // Watching lives inside Portfolio since Phase 5 (the old /watchlist 301s here).
  const unsubUrl = `${BASE}/portfolio?tab=watching&utm_source=alert&utm_medium=email`;

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
