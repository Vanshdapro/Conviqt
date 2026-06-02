// Transactional email via Resend's REST API.
//
// We call the HTTP endpoint with fetch rather than adding the `resend` SDK —
// it keeps the dependency surface flat (CLAUDE.md: don't add deps without a
// reason) and the payload is trivial. Resend's free tier (3k emails/day) is
// the chosen channel for watchlist alerts (Deliverable 3).
//
// This is email infrastructure, not a market-data API, so it does not violate
// the "Claude API is the only paid data API" constraint.
//
// Config (env): RESEND_API_KEY, plus optional RESEND_FROM (defaults to the
// Conviqt alerts address). When RESEND_API_KEY is absent — e.g. local dev — we
// no-op and log, so the alert cron can run end-to-end without sending mail.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Conviqt Alerts <alerts@conviqt.com>";

// Mirror the dev .env.local fallback used by anthropic.ts / supabase.ts: the
// desktop shell can inject empty vars that shadow .env.local.
function resolveVar(name: string): string {
  const fromEnv = process.env[name] ?? "";
  if (fromEnv.trim()) return fromEnv.trim();
  if (process.env.NODE_ENV === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs") as typeof import("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path") as typeof import("path");
      const text = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
      const m = text.match(new RegExp(`^${name}=(.+)$`, "m"));
      if (m) return m[1].trim();
    } catch {
      /* fall through */
    }
  }
  return fromEnv;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  // Optional plaintext fallback. Resend auto-generates one if omitted, but a
  // hand-written version improves deliverability for transactional mail.
  text?: string;
  // Optional sender override (e.g. a "digest@" address for the newsletter).
  // Falls back to RESEND_FROM env, then DEFAULT_FROM.
  from?: string;
}

export interface SendEmailResult {
  sent: boolean;
  id?: string;
  skipped?: "not_configured";
  error?: string;
}

export function isEmailConfigured(): boolean {
  return !!resolveVar("RESEND_API_KEY");
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = resolveVar("RESEND_API_KEY");
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send to ${params.to} ("${params.subject}")`
    );
    return { sent: false, skipped: "not_configured" };
  }

  const from = params.from?.trim() || resolveVar("RESEND_FROM") || DEFAULT_FROM;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.text ? { text: params.text } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] send to ${params.to} failed: ${res.status} ${detail}`);
      return { sent: false, error: `${res.status} ${detail}`.trim() };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    console.log(`[email] sent to ${params.to} ("${params.subject}") id=${data.id ?? "?"}`);
    return { sent: true, id: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] send to ${params.to} threw: ${msg}`);
    return { sent: false, error: msg };
  }
}
