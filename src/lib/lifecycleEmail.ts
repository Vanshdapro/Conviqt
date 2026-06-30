// Lifecycle emails — the onboarding/retention nudges that were missing.
//
//   • welcome     — sent once, the moment a user verifies their email. Points
//                   them straight at their first analysis.
//   • reengage_d3 — sent once to a user who signed up 3+ days ago and has never
//                   run a single analysis. CTA lands them on a live Quick Take
//                   (reuses the Research ?autorun=1 path), so the click itself
//                   delivers the aha moment, not just another login screen.
//
// Idempotency lives in lifecycle_email_log (migration 030): we CLAIM the row
// before sending, so a repeated auth callback or a retried cron can never
// double-send. A real send failure releases the claim so a later attempt can
// retry; a "not configured" skip (local dev, no RESEND_API_KEY) also releases
// so a properly-configured environment still sends later.
//
// Inline styles only (email clients strip <style>/class selectors). Colours are
// the Almanac brand hex values, kept in sync with watchlistEmail.ts.

import { getSupabaseAdmin } from "./supabase";
import { sendEmail } from "./email";

export type LifecycleEmailKind = "welcome" | "reengage_d3";

const BASE = "https://www.conviqt.com";
const FROM = "Conviqt <hello@conviqt.com>"; // same verified domain as alerts@

// Almanac palette (light, warm-editorial) — must match watchlistEmail.ts.
const INK = "#2A1C15";
const MUTED = "#63372C";
const FAINT = "#7A6A5A";
const ACCENT = "#0E7978";
const ON_ACCENT = "#FCFAF5";
const CARD_BG = "#FCFAF5";
const PAGE_BG = "#F5EFE1";
const RULE = "#DED2B8";

function admin() {
  return getSupabaseAdmin();
}

function firstNameOf(name: string | null): string | null {
  const n = (name ?? "").trim();
  return n ? n.split(/\s+/)[0] : null;
}

// ── Idempotency claim ────────────────────────────────────────────────────────

/**
 * Atomically claim the right to send (email, kind). Returns true only to the
 * caller that newly inserted the row; a duplicate insert returns false. Fails
 * CLOSED — if the log is unreachable we return false (better to miss a nudge
 * than to risk spamming), and log it.
 */
async function claim(email: string, kind: LifecycleEmailKind): Promise<boolean> {
  const e = email.toLowerCase().trim();
  try {
    const { data, error } = await admin()
      .from("lifecycle_email_log")
      .upsert({ email: e, kind }, { onConflict: "email,kind", ignoreDuplicates: true })
      .select("email");
    if (error) {
      console.error(`[lifecycle] claim ${kind} for ${e} errored:`, error.message);
      return false;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error(`[lifecycle] claim ${kind} threw:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/** Release a claim so a later attempt can retry (used when a send fails). */
async function release(email: string, kind: LifecycleEmailKind): Promise<void> {
  const e = email.toLowerCase().trim();
  try {
    await admin().from("lifecycle_email_log").delete().eq("email", e).eq("kind", kind);
  } catch {
    // Best-effort — a stuck claim just means we won't retry that one email.
  }
}

// ── Shared chrome ────────────────────────────────────────────────────────────

function shell(inner: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${PAGE_BG};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${PAGE_BG};padding:32px 0;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:540px;margin:0 auto;padding:0 16px;">
        <tr><td style="padding:0 0 24px;">
          <div style="font-family:Georgia,serif;font-size:18px;letter-spacing:0.22em;text-transform:uppercase;color:${INK};">CONVIQT</div>
        </td></tr>
        ${inner}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function cta(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;background:${ACCENT};color:${ON_ACCENT};font-family:system-ui,sans-serif;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;padding:13px 26px;border-radius:100px;">${label}</a>`;
}

function footer(note: string): string {
  return `<tr><td style="padding:24px 4px 0;border-top:1px solid ${RULE};">
    <div style="font-family:Georgia,serif;font-size:12px;line-height:1.6;color:${FAINT};">
      ${note}<br><br>
      Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is financial advice. Markets involve risk.
    </div>
  </td></tr>`;
}

export interface BuildEmailResult {
  subject: string;
  html: string;
  text: string;
}

// ── Welcome ──────────────────────────────────────────────────────────────────

export function buildWelcomeEmail(name: string | null): BuildEmailResult {
  const first = firstNameOf(name);
  const hi = first ? `Welcome, ${first}.` : "Welcome to Conviqt.";
  const url = `${BASE}/research?utm_source=lifecycle&utm_medium=email&utm_campaign=welcome`;

  const subject = first
    ? `${first}, your AI analyst team is ready`
    : "Your AI analyst team is ready";

  const html = shell(`
    <tr><td style="padding:0 0 16px;">
      <div style="font-family:Georgia,serif;font-size:24px;line-height:1.3;color:${INK};margin-bottom:14px;">${hi}</div>
      <div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${MUTED};margin-bottom:10px;">
        Ask anything about any stock and get a plain-English answer — backed by live market data and a public track record we can't hide from, losses included.
      </div>
      <div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${MUTED};margin-bottom:24px;">
        You've got <strong style="color:${INK};">5 free deep analyses every month</strong>, plus unlimited quick reads. The best way to see what we do is to run one.
      </div>
      ${cta(url, "Run your first analysis →")}
    </td></tr>
    ${footer("You're getting this because you just created a Conviqt account.")}
  `);

  const text = [
    `CONVIQT`,
    ``,
    hi,
    ``,
    `Ask anything about any stock and get a plain-English answer — backed by live market data and a public track record we can't hide from, losses included.`,
    ``,
    `You've got 5 free deep analyses every month, plus unlimited quick reads.`,
    ``,
    `Run your first analysis: ${url}`,
    ``,
    `Conviqt is a research and education tool, not financial advice. Markets involve risk.`,
  ].join("\n");

  return { subject, html, text };
}

// ── Re-engagement (day 3, never ran an analysis) ─────────────────────────────

export function buildReengageEmail(name: string | null): BuildEmailResult {
  const first = firstNameOf(name);
  const hi = first ? `${first}, you haven't run one yet.` : "You haven't run one yet.";
  // Land them straight on a live Quick Take — the click IS the aha moment.
  const url = `${BASE}/research?skill=quick-take&ticker=NVDA&autorun=1&utm_source=lifecycle&utm_medium=email&utm_campaign=reengage_d3`;

  const subject = first
    ? `${first}, see what Conviqt says about NVDA`
    : "See what Conviqt says about NVDA";

  const html = shell(`
    <tr><td style="padding:0 0 16px;">
      <div style="font-family:Georgia,serif;font-size:24px;line-height:1.3;color:${INK};margin-bottom:14px;">${hi}</div>
      <div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${MUTED};margin-bottom:10px;">
        You signed up but haven't run your first analysis. It takes about 20 seconds — here's a quick read on NVIDIA to show you the kind of plain-English answer you'll get.
      </div>
      <div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:${MUTED};margin-bottom:24px;">
        One tap runs it on the spot. No setup.
      </div>
      ${cta(url, "See the NVDA read →")}
    </td></tr>
    ${footer("You're getting this once because you created a Conviqt account and haven't tried it yet.")}
  `);

  const text = [
    `CONVIQT`,
    ``,
    hi,
    ``,
    `You signed up but haven't run your first analysis. It takes about 20 seconds — here's a quick read on NVIDIA to show you the kind of plain-English answer you'll get.`,
    ``,
    `See the NVDA read: ${url}`,
    ``,
    `Conviqt is a research and education tool, not financial advice. Markets involve risk.`,
  ].join("\n");

  return { subject, html, text };
}

// ── Send orchestration (claim → send → release-on-fail) ──────────────────────

async function sendOnce(
  email: string,
  kind: LifecycleEmailKind,
  build: (name: string | null) => BuildEmailResult,
  name: string | null
): Promise<"sent" | "duplicate" | "failed"> {
  const claimed = await claim(email, kind);
  if (!claimed) return "duplicate";

  const { subject, html, text } = build(name);
  const res = await sendEmail({ to: email, subject, html, text, from: FROM });
  if (res.sent) return "sent";

  // Not sent (real error, or not-configured skip) → release so a later,
  // properly-configured attempt can retry instead of being deduped forever.
  await release(email, kind);
  return "failed";
}

/** Fire the welcome email once. Safe to call on every auth callback. */
export async function sendWelcomeOnce(
  email: string,
  name: string | null
): Promise<"sent" | "duplicate" | "failed"> {
  return sendOnce(email, "welcome", buildWelcomeEmail, name);
}

/** Fire the day-3 re-engagement nudge once. */
export async function sendReengageOnce(
  email: string,
  name: string | null
): Promise<"sent" | "duplicate" | "failed"> {
  return sendOnce(email, "reengage_d3", buildReengageEmail, name);
}
