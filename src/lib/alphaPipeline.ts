import { getAlphaStore } from "./alphaStore";
import { getAnthropic, MODELS, WEB_SEARCH_TOOL, estimateCallCostUSD } from "./anthropic";
import { runSweep } from "./agents/sweep";
import { runPicker } from "./agents/picker";
import { runAlphaJudge, type AlphaJudgeCandidate } from "./agents/alphaJudge";
import { runSellCheck } from "./agents/sellCheck";
import type { AlphaPick, AlphaRunResult } from "./alphaTypes";

// runId format: "YYYY-MM-DD-MON", "YYYY-MM-DD-TUE", etc.
export function buildRunId(date: Date = new Date()): string {
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  return `${date.toISOString().slice(0, 10)}-${days[date.getUTCDay()]}`;
}

// Next run fires at 11:00 UTC (≈ 6 AM ET) on weekdays (Mon–Fri).
export function nextRunDate(from: Date = new Date()): string {
  const RUN_HOUR_UTC = 11;
  const next = new Date(from);
  const todayIsWeekday = next.getUTCDay() >= 1 && next.getUTCDay() <= 5;
  if (!todayIsWeekday || next.getUTCHours() >= RUN_HOUR_UTC) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.toISOString().slice(0, 10);
}

// Fetch current price for a ticker via a single web_search call.
// Returns { price, costUSD } or null if the search failed.
async function fetchCurrentPrice(ticker: string): Promise<{ price: number; costUSD: number } | null> {
  const client = getAnthropic();
  try {
    const response = await client.messages.create({
      model: MODELS.sweep,
      max_tokens: 256,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [WEB_SEARCH_TOOL as any],
      system: `You are a stock price lookup agent. Use web_search to get the current stock price for the given ticker, then output ONLY a JSON object on a single line: {"price": <number>}. If you cannot find the price, output: {"price": null}. No other text.`,
      messages: [{ role: "user", content: `What is the current stock price of ${ticker}?` }],
    });

    const costUSD = estimateCallCostUSD(MODELS.sweep, response.usage);

    // Parse the price from the last text block
    for (const block of response.content.reverse()) {
      if (block.type === "text") {
        const match = block.text.match(/\{"price"\s*:\s*([\d.]+|null)\}/);
        if (match) {
          const val = match[1];
          if (val === "null") return { price: 0, costUSD };
          const price = parseFloat(val);
          if (!isNaN(price) && price > 0) return { price, costUSD };
        }
      }
    }
    return { price: 0, costUSD };
  } catch (err) {
    console.error(`[alphaPipeline] fetchCurrentPrice(${ticker}) failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// Full alpha pipeline run.
//
// Steps:
// A. Fetch active positions.
// A2. Update current prices of active positions (cheap: 1 search each).
// B. Sell checks (parallel, Haiku + 1 web_search each).
// C. Mark exited positions SOLD.
// D. Idempotency guard — skip new picks if this run_id already has entries.
// E. Filter tickers already in active positions.
// F. Run picker to get candidates (Sonnet + web_searches).
// G. Sweep candidates (parallel, Haiku + 2 web_searches each).
// H. Alpha judge (Sonnet) — selects the single best pick.
// I. Validate and write the pick.
export async function runAlphaPipeline(): Promise<AlphaRunResult> {
  const t0 = Date.now();
  const now = new Date();
  const run_id = buildRunId(now);
  const entry_date = now.toISOString().slice(0, 10);
  const errors: string[] = [];
  const sells: Array<{ ticker: string; reason: string }> = [];
  const new_picks: Array<{ ticker: string }> = [];
  let totalCost = 0;

  const store = getAlphaStore();

  // === A. Fetch active picks ===
  let activePicks: AlphaPick[] = [];
  try {
    activePicks = await store.fetchActive();
    console.log(`[alphaPipeline] ${activePicks.length} active pick(s)`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[alphaPipeline] fetchActive failed:", msg);
    errors.push(msg);
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === A2. Update current prices of active positions ===
  if (activePicks.length > 0) {
    console.log(`[alphaPipeline] updating prices for ${activePicks.length} active pick(s)`);
    const priceResults = await Promise.allSettled(
      activePicks.map((p) => fetchCurrentPrice(p.ticker))
    );
    for (let i = 0; i < priceResults.length; i++) {
      const res = priceResults[i];
      const pick = activePicks[i];
      if (res.status === "rejected" || !res.value) continue;
      const { price, costUSD } = res.value;
      totalCost += costUSD;
      if (price > 0 && pick.entry_price > 0 && pick.id) {
        const changePct = ((price - pick.entry_price) / pick.entry_price) * 100;
        try {
          await store.updatePrice(pick.id, price, changePct, entry_date);
          console.log(`[alphaPipeline] price update ${pick.ticker}: $${price.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`);
        } catch (err) {
          console.error(`[alphaPipeline] updatePrice(${pick.ticker}) failed:`, err instanceof Error ? err.message : err);
        }
      }
    }
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
        await store.markSold(pick.id!, res.value.currentPrice, res.value.reason);
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
  try {
    const alreadyRan = await store.hasPicksForRunId(run_id);
    if (alreadyRan) {
      console.log(`[alphaPipeline] run_id=${run_id} already has a pick — skipping`);
      return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
    }
  } catch (err) {
    console.error("[alphaPipeline] idempotency check threw:", err instanceof Error ? err.message : err);
  }

  // === E. Run picker ===
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
    console.log("[alphaPipeline] picker returned 0 candidates — no new pick this run");
    return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
  }

  // === F. Filter already-active tickers ===
  const stillActiveTickers = new Set(
    activePicks
      .filter((p) => p.status === "ACTIVE")
      .map((p) => p.ticker.toUpperCase())
  );
  const topCandidates = pickerResult.picks
    .filter((p) => !stillActiveTickers.has(p.ticker.toUpperCase()))
    .slice(0, 2);

  if (topCandidates.length === 0) {
    console.log("[alphaPipeline] all candidates already in active positions — skipping");
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

  // === H. Alpha judge ===
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

  // === I. Validate and write ===
  for (const draft of judgeResult.drafts) {
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
      current_price: null,
      price_change_pct: null,
      price_last_updated: null,
      exit_date: null,
      exit_price: null,
      exit_reason: null,
    };

    try {
      await store.insert(row);
      new_picks.push({ ticker: draft.ticker });
      console.log(`[alphaPipeline] saved pick: ${draft.ticker} @$${draft.entryPrice}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[alphaPipeline] insert failed:", msg);
      errors.push(msg);
    }
  }

  if (totalCost > 0.45) {
    console.warn(`[alphaPipeline] cost ceiling: $${totalCost.toFixed(4)} > $0.45`);
  }

  return { run_id, sells, new_picks, errors, costUSD: totalCost, durationMs: Date.now() - t0 };
}
