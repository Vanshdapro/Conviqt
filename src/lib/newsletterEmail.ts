// HTML/text builders for the Disagreement Digest newsletter (Deliverable 6).
//
// Two emails:
//   buildConfirmEmail()  — double opt-in. One CTA → /api/newsletter/confirm.
//   buildDigestEmail()   — the weekly issue: top 5 contested stocks, each with
//                          ticker, conviction, disagreement, the point of
//                          dissent, and a link to the full Council analysis.
//
// Editorial dark theme matching watchlistEmail.ts and the app. Inline styles
// only (email clients strip <style> blocks and class selectors).

import type { DigestEntry } from "./newsletterDigest";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const CARD_BG = "#0c1524";
const PAGE_BG = "#070b12";
const RULE = "rgba(232,237,248,0.10)";

// Resolve the public site URL (prod links must be absolute). Mirrors the
// NEXT_PUBLIC_SITE_URL convention used elsewhere; falls back to the apex www.
export function siteBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  const base = raw || "https://www.conviqt.com";
  return base.replace(/\/+$/, "");
}

function verdictColor(v: string | null): string {
  if (v === "BUY") return "#34d399";
  if (v === "SELL") return "#f87171";
  return "#f59e0b"; // HOLD / unknown
}

function fmtToday(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --------------------------------------------------------------------------
// Confirmation email (double opt-in)
// --------------------------------------------------------------------------

export interface ConfirmEmailResult {
  subject: string;
  html: string;
  text: string;
}

export function buildConfirmEmail(confirmToken: string): ConfirmEmailResult {
  const base = siteBaseUrl();
  const confirmUrl = `${base}/api/newsletter/confirm?token=${encodeURIComponent(
    confirmToken
  )}`;

  const subject = "Confirm your Conviqt Disagreement Digest subscription";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE_BG};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${PAGE_BG};padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;margin:0 auto;padding:0 16px;">
        <tr><td style="padding:0 0 24px;">
          <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.22em;text-transform:uppercase;color:${INK};">CONVIQT</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:${FAINT};margin-top:6px;">The Disagreement Digest</div>
        </td></tr>
        <tr><td style="background:${CARD_BG};border:1px solid ${RULE};border-radius:14px;padding:28px 26px;">
          <div style="font-family:Georgia,serif;font-size:21px;line-height:1.35;color:${INK};margin-bottom:12px;">One click to confirm.</div>
          <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:${MUTED};margin-bottom:22px;">
            Every Monday you'll get the five stocks Conviqt's AI research council split on hardest — ticker, conviction, disagreement, and the crux of each fight. Free, and you can leave any time.
            <br><br>
            Confirm your email to start receiving it:
          </div>
          <a href="${confirmUrl}" style="display:inline-block;background:${ACCENT};color:#06101f;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;padding:13px 26px;border-radius:100px;">
            Confirm subscription →
          </a>
          <div style="font-family:Georgia,serif;font-size:12px;line-height:1.6;color:${FAINT};margin-top:22px;">
            If the button doesn't work, paste this link into your browser:<br>
            <a href="${confirmUrl}" style="color:${MUTED};word-break:break-all;">${confirmUrl}</a>
          </div>
        </td></tr>
        <tr><td style="padding:20px 4px 0;">
          <div style="font-family:Georgia,serif;font-size:12px;line-height:1.6;color:${FAINT};">
            You're receiving this because someone entered this address at conviqt.com. If that wasn't you, just ignore this email — you won't be subscribed unless you confirm.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    "CONVIQT — The Disagreement Digest",
    "",
    "Confirm your subscription to start receiving the weekly digest of the five stocks our AI research council split on hardest.",
    "",
    `Confirm: ${confirmUrl}`,
    "",
    "If you didn't request this, ignore this email — you won't be subscribed unless you confirm.",
  ].join("\n");

  return { subject, html, text };
}

// --------------------------------------------------------------------------
// Weekly digest email
// --------------------------------------------------------------------------

function entryHtml(entry: DigestEntry, rank: number): string {
  const base = siteBaseUrl();
  const url = `${base}/stock/${encodeURIComponent(
    entry.ticker
  )}?utm_source=digest&utm_medium=email&utm_campaign=disagreement_digest`;
  const vc = verdictColor(entry.verdict);
  return `
  <tr><td style="padding:0 0 14px;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
      style="background:${CARD_BG};border:1px solid ${RULE};border-radius:14px;">
      <tr><td style="padding:22px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="vertical-align:top;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${FAINT};margin-bottom:8px;">#${rank} MOST CONTESTED</div>
              <div style="font-family:Georgia,serif;font-size:22px;line-height:1.2;color:${INK};">
                ${esc(entry.ticker)}
                <span style="font-size:14px;color:${MUTED};font-style:italic;">${esc(entry.companyName)}</span>
              </div>
            </td>
            <td style="vertical-align:top;text-align:right;white-space:nowrap;">
              <span style="display:inline-block;font-family:system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.06em;color:${vc};border:1px solid ${vc};border-radius:100px;padding:4px 12px;">${esc(
                entry.verdict
              )}</span>
            </td>
          </tr>
        </table>

        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:16px 0 14px;">
          <tr>
            <td style="width:50%;padding-right:8px;">
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${FAINT};margin-bottom:4px;">CONVICTION</div>
              <div style="font-family:Georgia,serif;font-size:18px;color:${INK};">${entry.conviction}<span style="font-size:12px;color:${FAINT};">/100</span></div>
            </td>
            <td style="width:50%;padding-left:8px;border-left:1px solid ${RULE};">
              <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${ACCENT};margin-bottom:4px;">DISAGREEMENT</div>
              <div style="font-family:Georgia,serif;font-size:18px;color:${ACCENT};">${entry.disagreement}<span style="font-size:12px;color:${FAINT};">/100</span></div>
            </td>
          </tr>
        </table>

        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:${FAINT};margin-bottom:6px;">THE SPLIT</div>
        <div style="font-family:Georgia,serif;font-size:15px;line-height:1.55;color:${MUTED};margin-bottom:18px;">${esc(
          entry.dissent
        )}</div>

        <a href="${url}" style="display:inline-block;background:${ACCENT};color:#06101f;font-family:system-ui,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.02em;text-decoration:none;padding:11px 22px;border-radius:100px;">
          See where they split →
        </a>
      </td></tr>
    </table>
  </td></tr>`;
}

export interface DigestEmailResult {
  subject: string;
  html: string;
  text: string;
}

export function buildDigestEmail(
  intro: string,
  entries: DigestEntry[],
  unsubscribeToken: string
): DigestEmailResult {
  const base = siteBaseUrl();
  const unsubUrl = `${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(
    unsubscribeToken
  )}`;

  const top = entries[0];
  const subject = top
    ? `The 5 most contested stocks this week — starting with ${top.ticker}`
    : "This week's Disagreement Digest";

  const entriesHtml = entries.map((e, i) => entryHtml(e, i + 1)).join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE_BG};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${PAGE_BG};padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;padding:0 16px;">
        <tr><td style="padding:0 0 8px;">
          <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.22em;text-transform:uppercase;color:${INK};">CONVIQT</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:${FAINT};margin-top:6px;">The Disagreement Digest · ${fmtToday()}</div>
        </td></tr>
        <tr><td style="padding:18px 4px 26px;">
          <div style="font-family:Georgia,serif;font-size:26px;line-height:1.25;color:${INK};margin-bottom:14px;">The 5 most contested stocks this week.</div>
          <div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${MUTED};">${esc(
            intro
          )}</div>
        </td></tr>
        ${entriesHtml}
        <tr><td style="padding:18px 4px 0;border-top:1px solid ${RULE};">
          <div style="font-family:Georgia,serif;font-size:12px;line-height:1.6;color:${FAINT};">
            Conviqt runs a panel of AI analysts on each ticker; a high disagreement score means they did <em>not</em> reach consensus. These are AI-generated analyses for education — not personalized financial advice. Every number on a full report links to its source.
            <br><br>
            <a href="${unsubUrl}" style="color:${MUTED};">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="${base}" style="color:${MUTED};">conviqt.com</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    "CONVIQT — The Disagreement Digest",
    fmtToday(),
    "",
    "THE 5 MOST CONTESTED STOCKS THIS WEEK",
    "",
    intro,
    "",
    ...entries.map((e, i) => {
      const url = `${base}/stock/${encodeURIComponent(e.ticker)}`;
      return [
        `#${i + 1}  ${e.ticker} — ${e.companyName}`,
        `    Verdict ${e.verdict} · conviction ${e.conviction}/100 · disagreement ${e.disagreement}/100`,
        `    The split: ${e.dissent}`,
        `    Full analysis: ${url}`,
        "",
      ].join("\n");
    }),
    "AI-generated analysis for education — not personalized financial advice.",
    `Unsubscribe: ${unsubUrl}`,
  ].join("\n");

  return { subject, html, text };
}
