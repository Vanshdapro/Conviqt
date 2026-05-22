import { getSupabaseAdmin } from "./supabase";
import { runSweep } from "./agents/sweep";
import { runPicker } from "./agents/picker";
import { runAlphaJudge, type AlphaJudgeCandidate } from "./agents/alphaJudge";
import { runSellCheck } from "./agents/sellCheck";
import type { AlphaPick, AlphaRunResult } from "./alphaTypes";

// runId format: "YYYY-MM-DD-TUE" or "YYYY-MM-DD-THU"
export function buildRunId(date: Date = new Date()): string {
  const day = date.getUTCDay();
  const label = day === 2 ? "TUE" : day === 4 ? "THU" : ["SUN","MON","TUE","WED","THU","FRI","SAT"][day];
  return `${date.toISOString().slice(0, 10)}-${label}`;
}

// Compute the next scheduled run date from a given UTC Date.
// Runs fire at 11:00 UTC (≈ 6 AM ET) on Tuesdays and Thursdays.
export function nextRunDate(from: Date = new Date()): string {
  const RUN_HOUR_UTC = 11;
  const day = from.getUTCDay();  // 0=Sun … 6=Sat
  const hour = from.getUTCHours();

  let daysUntil: number;

  if ((day === 2 || day === 4) && hour < RUN_HOUR_UTC) {
    // Run day, but the window hasn't opened yet — next run is today.
    daysUntil = 0;
  } else if (day === 0) {
    daysUntil = 2; // Sun → Tue
  } else if (day === 1) {
    daysUntil = 1; // Mon → Tue
  } else if (day === 2) {
    daysUntil = 2; // Tue post-run → Thu
  } else if (day === 3) {
    daysUntil = 1; // Wed → Thu
  } else {
    // Thu post-run (day=4,hour≥11), Fri (5), Sat (6) → next Tue
    daysUntil = (2 - day + 7) % 7;
    if (daysUntil === 0) daysUntil = 7; // safety net — should never happen here
  }

  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + daysUntil);
  return next.toISOString().slice(0, 10);
}

async function fetchActivePicks(): Promise<AlphaPick[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("alpha_picks")
    .select("*")
    .eq("status", "ACTIVE");
  if (error) throw new Error(`[alphaPipeline] fetchActivePicks: ${error.message}`);
  return (data ?? []) as AlphaPick[];
}

async function markSold(
  id: string,
  currentPrice: number,
  reason: string
): Promise<void> {
  const db = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await db
    .from("alpha_picks")
    .update({
      status: "SOLD",
      exit_date: today,
      exit_price: currentPrice > 0 ? currentPrice : null,
      exit_reason: reason,
    })
    .eq("id", id);
  if (error) throw new Error(`[alphaPipeline] markSold ${id}: ${error.message}`);
}

async function insertPick(pick: Omit<AlphaPick, "id" | "created_at">): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("alpha_picks").insert(pick);
  if (error) throw new Error(`[alphaPipeline] insertPick ${pick.ticker}: ${error.message}`);
}

async function runIdAlreadyHasPicks(run_id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("alpha_picks")
    .select("id")
    .eq("run_id", run_id)
    .limit(1);
  if (error) {
    console.warn(`[alphaPipeline] idempotency check failed: ${error.message}`);
    return false; // err on the side of running rather than silently skipping
  }
  return (data ?? []).length > 0;
}

// Full alpha pipeline run. Called by /api/alpha/run on the cron schedule
// (Tue/Thu at 11 UTC) or on-demand via the admin trigger.
//
// Steps:
// A. Fetch active positions from Supabase.
// B. Run sell checks in parallel (Haiku + 1 web_search each).
// C. Mark exited positions SOLD in Supabase.
// D. Idempotency check — skip new picks if this run_id already has entries.
// E. Filter out tickers that are already in active positions.
// F. Run picker to get new candidates (Sonnet + web_searches).
// G. For each candidate, run sweep (Haiku + 2 web_searches).
// H. Run alpha judge (Sonnet) — selects best ≤2 picks with structured fields.
// I. Validate and write new picks to Supabase.
export async function runAlphaPipeline(): Promise<AlphaRunResult> {
  const t0 = Date.now();
  const now = new Date();
  const run_id = buildRunId(now);
  const entry_date = now.toISOString().slice(0, 10);
  const errors: string[] = [];
  const sells: Array<{ ticker: string; reason: string }> = [];
  const new_picks: Array<{ ticker: string }> = [];
  let totalCost = 0;

  // === A. Fetch active picks ===
  let activePicks: AlphaPick[] = [];
  try {
    activePicks = await fetchActivePicks();
    console.log(`[alphaPipeline] ${activePicks.length} active pick(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alphaPipeline] fetchActivePicks failed:", msg);
    errors.push(msg);
    // Cannot proceed safely without knowing current positions.
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === B. Sell checks (parallel) ===
  const sellCheckResults = await Promise.allSettled(
    activePicks.map((p) => runSellCheck(p))
  );

  for (let i = 0; i < sellCheckResults.length; i++) {
    const res = sellCheckResults[i];
    const pick = activePicks[i];
    if (res.status === "rejected") {
      const msg = `sell check failed for ${pick.ticker}: ${res.reason}`;
      console.error("[alphaPipeline]", msg);
      errors.push(msg);
      continue;
    }
    totalCost += res.value.costUSD;
    if (res.value.shouldSell) {
      // === C. Mark SOLD ===
      try {
        await markSold(pick.id!, res.value.currentPrice, res.value.reason);
        // Remove from activePicks so we don't filter it as "still active" below.
        activePicks[i] = { ...pick, status: "SOLD" };
        sells.push({ ticker: pick.ticker, reason: res.value.reason });
        console.log(`[alphaPipeline] sold ${pick.ticker}: ${res.value.reason}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[alphaPipeline] markSold failed:", msg);
        errors.push(msg);
      }
    }
  }

  // === D. Idempotency guard ===
  // If this run_id already has picks (e.g. button clicked twice), skip new picks.
  try {
    const alreadyRan = await runIdAlreadyHasPicks(run_id);
    if (alreadyRan) {
      console.log(`[alphaPipeline] run_id=${run_id} already has picks — skipping new picks step`);
      return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alphaPipeline] idempotency check threw:", msg);
    // Don't abort — continue with new picks
  }

  // === E. Run picker to get candidates ===
  let pickerResult;
  try {
    pickerResult = await runPicker();
    totalCost += pickerResult.costUSD;
    console.log(`[alphaPipeline] picker returned ${pickerResult.picks.length} candidate(s)`);
  } catch (err) {
    const msg = `picker failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[alphaPipeline]", msg);
    errors.push(msg);
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  if (pickerResult.picks.length === 0) {
    console.log("[alphaPipeline] picker returned 0 candidates — no new picks this run");
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === F. Filter out tickers already in active positions ===
  // Prevents inserting a duplicate entry for a stock we're already holding.
  const stillActiveTickers = new Set(
    activePicks
      .filter((p) => p.status === "ACTIVE")
      .map((p) => p.ticker.toUpperCase())
  );
  const topCandidates = pickerResult.picks
    .filter((p) => !stillActiveTickers.has(p.ticker.toUpperCase()))
    .slice(0, 3);

  if (topCandidates.length === 0) {
    console.log("[alphaPipeline] all candidates are already in active positions — skipping");
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === G. Sweep candidates (parallel) ===
  const sweepResults = await Promise.allSettled(
    topCandidates.map((p) => runSweep(p.ticker))
  );

  const validCandidates: AlphaJudgeCandidate[] = [];
  for (let i = 0; i < sweepResults.length; i++) {
    const res = sweepResults[i];
    const candidate = topCandidates[i];
    if (res.status === "rejected") {
      const msg = `sweep failed for ${candidate.ticker}: ${res.reason}`;
      console.error("[alphaPipeline]", msg);
      errors.push(msg);
      continue;
    }
    totalCost += res.value.costUSD;
    validCandidates.push({
      factSheet: res.value.factSheet,
      pickerThesis: candidate.thesis,
    });
  }

  if (validCandidates.length === 0) {
    const msg = "all sweeps failed — no valid candidates";
    console.error("[alphaPipeline]", msg);
    errors.push(msg);
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === H. Alpha judge — picks the best ≤2 ===
  let judgeResult;
  try {
    judgeResult = await runAlphaJudge(validCandidates);
    totalCost += judgeResult.costUSD;
    console.log(`[alphaPipeline] judge selected ${judgeResult.drafts.length} pick(s)`);
  } catch (err) {
    const msg = `alpha judge failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[alphaPipeline]", msg);
    errors.push(msg);
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === I. Validate and write picks to Supabase ===
  for (const draft of judgeResult.drafts) {
    // Final validation gate (belt-and-suspenders — the judge already filters,
    // but we re-check before writing to the database).
    if (draft.sources.length < 2) {
      const msg = `skipping ${draft.ticker}: only ${draft.sources.length} source(s) — need ≥2`;
      console.error("[alphaPipeline]", msg);
      errors.push(msg);
      continue;
    }
    if (!draft.entryPrice || draft.entryPrice <= 0) {
      const msg = `skipping ${draft.ticker}: entry_price=${draft.entryPrice} is not a real number`;
      console.error("[alphaPipeline]", msg);
      errors.push(msg);
      continue;
    }
    if (draft.conviction < 7) {
      const msg = `skipping ${draft.ticker}: conviction=${draft.conviction} < 7`;
      console.error("[alphaPipeline]", msg);
      errors.push(msg);
      continue;
    }

    const row: Omit<AlphaPick, "id" | "created_at"> = {
      run_id,
      ticker: draft.ticker,
      company_name: draft.companyName,
      entry_price: draft.entryPrice,
      entry_date,
      target_price: draft.targetPrice,
      stop_loss: draft.stopLoss,
      catalyst: draft.catalyst,
      conviction: draft.conviction,
      bull_thesis: draft.bullThesis,
      bear_thesis: draft.bearThesis,
      sources: draft.sources,
      status: "ACTIVE",
      exit_date: null,
      exit_price: null,
      exit_reason: null,
    };

    try {
      await insertPick(row);
      new_picks.push({ ticker: draft.ticker });
      console.log(`[alphaPipeline] inserted pick: ${draft.ticker} @$${draft.entryPrice}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[alphaPipeline] insertPick failed:", msg);
      errors.push(msg);
    }
  }

  if (totalCost > 0.35) {
    console.warn(`[alphaPipeline] cost ceiling exceeded: $${totalCost.toFixed(4)} > $0.35`);
  }

  return {
    run_id,
    sells,
    new_picks,
    errors,
    costUSD: totalCost,
    durationMs: Date.now() - t0,
  };
}
