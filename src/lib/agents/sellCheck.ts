import {
  getAnthropic,
  MODELS,
  estimateCallCostUSD,
} from "../anthropic";

// One search per sell check keeps cost at ~$0.012 per active pick.
// Using the shared WEB_SEARCH_TOOL (max_uses:2) would double that for no gain.
const SELL_CHECK_WEB_SEARCH = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 1,
};
import type { AlphaPick } from "../alphaTypes";

// Sell check: Haiku + 1 web_search per active pick.
// Checks whether the stop-loss or target has been hit, or whether a
// fundamental event warrants early exit.
// Cost: ~$0.01-0.012 per call.

const SYSTEM = `You are a portfolio monitor for a paper trading account.

Given an open position, use web_search to find the current price and any major news.
Then call check_sell_signal with your assessment.

Rules:
- STOP HIT: current price <= stop_loss. This is mechanical — always trigger.
- TARGET HIT: current price >= target_price. Always trigger.
- FUNDAMENTAL EXIT: major adverse event (fraud, bankruptcy, earnings miss + guidance cut > 20%, FDA rejection, acquisition at below-stop price). Only trigger on clear, material adverse facts — not routine analyst downgrades.
- If none of the above, return should_sell: false.`;

const CHECK_SELL_TOOL = {
  name: "check_sell_signal",
  description: "Report the sell assessment for this position.",
  input_schema: {
    type: "object" as const,
    properties: {
      current_price: {
        type: "number",
        description: "Most recent stock price from web_search. 0 if not found.",
      },
      should_sell: {
        type: "boolean",
        description: "True if stop, target, or fundamental exit condition is met.",
      },
      reason: {
        type: "string",
        description:
          "One sentence. E.g. 'Stop hit: price $45.20 fell below stop $46.00' or 'Target hit: price $152.00 exceeded target $148.00' or 'No exit condition met'.",
      },
      exit_type: {
        type: "string",
        enum: ["stop", "target", "fundamental", "none"],
      },
    },
    required: ["current_price", "should_sell", "reason", "exit_type"],
  },
};

export interface SellCheckResult {
  ticker: string;
  shouldSell: boolean;
  reason: string;
  currentPrice: number;
  costUSD: number;
}

export async function runSellCheck(pick: AlphaPick): Promise<SellCheckResult> {
  const anthropic = getAnthropic();

  const response = await anthropic.messages.create({
    model: MODELS.specialist, // Haiku
    max_tokens: 800,
    system: SYSTEM,
    tools: [SELL_CHECK_WEB_SEARCH, CHECK_SELL_TOOL],
    messages: [
      {
        role: "user",
        content: `Position: ${pick.ticker} (${pick.company_name})
Entry: $${pick.entry_price} on ${pick.entry_date}
Stop-loss: $${pick.stop_loss}
Target: $${pick.target_price}
Original catalyst: ${pick.catalyst}

Search for the current price and any major news. Then call check_sell_signal.`,
      },
    ],
  });

  // Log search queries for auditing.
  for (const block of response.content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      const q = (block.input as { query?: string })?.query ?? "?";
      console.log(`[SellCheck] ${pick.ticker} web_search: "${q}"`);
    }
  }

  const toolUse = response.content.find(
    (b) => b.type === "tool_use" && b.name === CHECK_SELL_TOOL.name
  );

  if (!toolUse || toolUse.type !== "tool_use") {
    // If the model didn't call the tool, assume hold — don't accidentally sell.
    console.warn(`[SellCheck] ${pick.ticker}: no check_sell_signal call, defaulting to hold`);
    const webSearchCount = response.content.filter(
      (b) => b.type === "server_tool_use" && b.name === "web_search"
    ).length;
    return {
      ticker: pick.ticker,
      shouldSell: false,
      reason: "Sell check inconclusive — model did not return a signal.",
      currentPrice: 0,
      costUSD: estimateCallCostUSD(MODELS.specialist, response.usage, webSearchCount),
    };
  }

  const input = toolUse.input as {
    current_price: number;
    should_sell: boolean;
    reason: string;
    exit_type: string;
  };

  const webSearchCount = response.content.filter(
    (b) => b.type === "server_tool_use" && b.name === "web_search"
  ).length;
  const costUSD = estimateCallCostUSD(MODELS.specialist, response.usage, webSearchCount);

  return {
    ticker: pick.ticker,
    shouldSell: !!input.should_sell,
    reason: input.reason?.trim() ?? "",
    currentPrice: typeof input.current_price === "number" ? input.current_price : 0,
    costUSD,
  };
}
