// GET/POST /api/newsletter/send  — the weekly Disagreement Digest blast
// (Deliverable 6). Wired to a Monday-morning Vercel cron (see vercel.json).
//
// Pipeline (all curation, near-zero marginal cost):
//   1. Pull the 5 most-CONTESTED reports run in the last 7 days from the ALREADY
//      cached stock_reports table — ORDER BY disagreement DESC. Zero Council
//      runs, zero web_search.
//   2. ONE Haiku call writes the editorial intro + per-stock dissent lines
//      (~<1¢, with a deterministic bearCase fallback if it fails).
//   3. Claim the ISO week atomically (newsletter_send_log) so a retry or a
//      manual+cron overlap can't double-blast the list.
//   4. Send one digest per confirmed subscriber, each with their own unsub link.
//
// Auth: bearer CRON_SECRET (Vercel cron) or ALPHA_RUN_SECRET (manual). Same
// pattern as /api/alpha/run, /api/stock/refresh, /api/watchlist/sweep.
//
// Manual controls (query params, still behind auth):
//   ?dry=1    — build the digest + report what WOULD send, but send nothing and
//               do NOT claim the week. For previewing.
//   ?force=1  — bypass the weekly idempotency gate (re-send this week).

import { NextResponse } from "next/server";
import { getStockReportStore, type StoredReport } from "@/lib/stockReports";
import { getNewsletterStore, isoWeekKey } from "@/lib/newsletter";
import { buildDigestContent } from "@/lib/newsletterDigest";
import { buildDigestEmail } from "@/lib/newsletterEmail";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // "this week" = last 7 days
const TOP_N = 5; // "The 5 Most Contested Stocks This Week"

const NEWSLETTER_FROM =
  process.env.NEWSLETTER_FROM?.trim() || "Conviqt Digest <digest@conviqt.com>";

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const cronSecret = process.env.CRON_SECRET;
  const alphaSecret = process.env.ALPHA_RUN_SECRET;
  if (cronSecret && token === cronSecret) return true;
  if (alphaSecret && token === alphaSecret) return true;
  return false;
}

async function handle(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1";
  const weekKey = isoWeekKey();

  try {
    // 1. The week's most-contested reports (free — already cached).
    let reports: StoredReport[] = [];
    try {
      reports = await getStockReportStore().listContested(WINDOW_MS, TOP_N);
    } catch (err) {
      console.error(
        "[newsletter/send] listContested failed:",
        err instanceof Error ? err.message : err
      );
    }

    if (reports.length === 0) {
      console.log(`[newsletter/send] ${weekKey}: no contested reports in the last 7 days — skipping.`);
      return NextResponse.json({
        success: true,
        weekKey,
        skipped: "no_content",
        tickers: 0,
      });
    }

    const store = getNewsletterStore();
    const recipients = await store.listConfirmed();

    if (recipients.length === 0 && !dryRun) {
      console.log(`[newsletter/send] ${weekKey}: no confirmed subscribers — skipping.`);
      return NextResponse.json({
        success: true,
        weekKey,
        skipped: "no_subscribers",
        tickers: reports.length,
      });
    }

    // 2. Editorial layer (the one cheap Claude call). Never throws.
    const digest = await buildDigestContent(reports);

    // Dry run: report what would go out, send nothing, don't claim the week.
    if (dryRun) {
      const preview = buildDigestEmail(digest.intro, digest.entries, "PREVIEW_TOKEN");
      console.log(
        `[newsletter/send] DRY ${weekKey}: would send "${preview.subject}" to ${recipients.length} subscribers (gen=${digest.generatedBy}, est $${digest.costUSD.toFixed(4)})`
      );
      return NextResponse.json({
        success: true,
        dryRun: true,
        weekKey,
        subject: preview.subject,
        tickers: digest.entries.map((e) => ({
          ticker: e.ticker,
          conviction: e.conviction,
          disagreement: e.disagreement,
          dissent: e.dissent,
        })),
        recipientCount: recipients.length,
        generatedBy: digest.generatedBy,
        estCostUSD: Number(digest.costUSD.toFixed(4)),
        htmlPreview: preview.html,
      });
    }

    // 3. Claim the week BEFORE sending — atomic dedup against retries/overlap.
    if (!force) {
      const won = await store.claimSend(weekKey, recipients.length, reports.length);
      if (!won) {
        console.log(`[newsletter/send] ${weekKey}: already sent this week — skipping (use ?force=1 to override).`);
        return NextResponse.json({
          success: true,
          weekKey,
          skipped: "already_sent",
        });
      }
    }

    // 4. One personalized digest per subscriber.
    let sent = 0;
    const failures: string[] = [];
    for (const r of recipients) {
      const { subject, html, text } = buildDigestEmail(
        digest.intro,
        digest.entries,
        r.unsubscribeToken
      );
      const res = await sendEmail({
        to: r.email,
        subject,
        html,
        text,
        from: NEWSLETTER_FROM,
      });
      if (res.sent) sent += 1;
      else if (res.error) failures.push(`${r.email}: ${res.error}`);
    }

    console.log(
      `[newsletter/send] ${weekKey}: done — tickers=${reports.length} recipients=${recipients.length} ` +
        `sent=${sent} failures=${failures.length} gen=${digest.generatedBy} est=$${digest.costUSD.toFixed(4)}`
    );

    return NextResponse.json({
      success: true,
      weekKey,
      forced: force,
      tickers: reports.length,
      recipientCount: recipients.length,
      emailsSent: sent,
      failures,
      generatedBy: digest.generatedBy,
      estCostUSD: Number(digest.costUSD.toFixed(4)),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[newsletter/send] threw:", msg);
    return NextResponse.json({ success: false, weekKey, error: msg }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
