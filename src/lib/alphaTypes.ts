// Types shared between the alpha pipeline, API routes, and frontend.

export interface AlphaPickSource {
  url: string;
  title: string;
  publisher: string;
}

// Row shape for the alpha_picks Supabase table.
export interface AlphaPick {
  id?: string;
  run_id: string;
  ticker: string;
  company_name: string;
  entry_price: number;
  entry_date: string; // YYYY-MM-DD
  target_price: number;
  stop_loss: number;
  catalyst: string;
  conviction: number; // 1-10
  bull_thesis: string;
  bear_thesis: string;
  sources: AlphaPickSource[];
  status: "ACTIVE" | "SOLD";
  // Current price snapshot — updated each time the pipeline runs
  current_price?: number | null;
  price_change_pct?: number | null; // ((current - entry) / entry) * 100
  price_last_updated?: string | null; // YYYY-MM-DD
  exit_date?: string | null;
  exit_price?: number | null;
  exit_reason?: string | null;
  created_at?: string;
}

// What the alpha judge produces before Supabase write validation.
export interface AlphaPickDraft {
  ticker: string;
  companyName: string;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  catalyst: string;
  conviction: number; // 1-10
  bullThesis: string;
  bearThesis: string;
  sources: AlphaPickSource[]; // already resolved from FactSheet sources
}

// Result returned from the full pipeline run.
export interface AlphaRunResult {
  run_id: string;
  sells: Array<{ ticker: string; reason: string }>;
  new_picks: Array<{ ticker: string }>;
  errors: string[];
  costUSD: number;
  durationMs: number;
}
