"use client";

// Portfolio surface (playbook Phase 5) — the fourth of the five surfaces.
//
// Holdings tab: the holdings table (add by ticker search, shares + cost
// basis, CSV import), live values from the marketdata layer, day/total P/L
// as market-color pills, the stats strip (Beta · Volatility · Max Drawdown ·
// Sharpe) where every ⓘ teaches what the number means, and the AI Health
// Check (the audit pipeline, rendered in the Phase 3 answer style).
//
// Watching tab: the old standalone Watchlist, merged here. Live prices,
// next-earnings dates, one-tap handoff to Research.
//
// Copy rules (CLAUDE.md): no agents/credits/pipeline words in rendered text;
// data that's unavailable says so — never a guessed number.

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Card,
  ChangePill,
  ChangeText,
  EmptyState,
  Sheet,
  SkeletonText,
  StatTile,
} from "@/components/ui";
import { AuditAnswer } from "@/components/research/answers";
import { PaywallSheet } from "@/components/PaywallSheet";
import { lessonHref } from "@/components/research/learnLinks";
import { STOCK_UNIVERSE } from "@/lib/tickers";
import type { Holding, PortfolioAuditResult } from "@/lib/portfolio/types";
import type {
  LiveHoldingRow,
  LiveStatsStrip,
  LiveTotals,
} from "@/lib/portfolio/live";
import { parseHoldingsCsv } from "./csv";
import { LensPanel } from "./LensPanel";
import RadarPanel from "./RadarPanel";
import { STAT_INFO, STAT_KEYS, type StatKey, type StatLessonMap } from "./statInfo";

// ── Shared formatting ────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** Unsigned money — direction is the arrow/color's job (ChangeText). */
function fmtMoneyAbs(n: number): string {
  return fmtMoney(Math.abs(n));
}
function fmtPctAbs(n: number): string {
  return `${Math.abs(n).toFixed(2)}%`;
}
function fmtShares(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function timeAgoLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,9}$/;
const MAX_HOLDINGS = 40;

// ── Ticker search (combobox over the covered universe) ──────────────────────

function tickerMatches(query: string, universeOnly: boolean) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const qLower = query.trim().toLowerCase();
  const byTicker = STOCK_UNIVERSE.filter((e) => e.ticker.startsWith(q));
  const byName = STOCK_UNIVERSE.filter(
    (e) => !e.ticker.startsWith(q) && e.name.toLowerCase().includes(qLower)
  );
  const out = [...byTicker, ...byName].slice(0, 6);
  // Outside the covered universe (ETFs, smaller names) the feeds can often
  // still price it — offer the raw symbol unless this list is universe-bound.
  if (!universeOnly && TICKER_RE.test(q) && !out.some((e) => e.ticker === q)) {
    out.push({ ticker: q, name: "Use this symbol as typed" });
  }
  return out;
}

function TickerSearch({
  value,
  onChange,
  onPick,
  placeholder,
  universeOnly = false,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (ticker: string) => void;
  placeholder: string;
  universeOnly?: boolean;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => tickerMatches(value, universeOnly), [value, universeOnly]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="cvq-folio-search" ref={rootRef}>
      <input
        type="text"
        className="cvq-folio-search-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={30}
      />
      {open && matches.length > 0 && (
        <div className="cvq-folio-suggest" role="listbox">
          {matches.map((m) => (
            <button
              key={m.ticker}
              type="button"
              role="option"
              aria-selected={false}
              className="cvq-folio-suggest-row"
              onClick={() => {
                onPick(m.ticker);
                setOpen(false);
              }}
            >
              <span className="cvq-ticker-sym">{m.ticker}</span>
              <span className="cvq-folio-suggest-name">{m.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Health Check stream (audit pipeline → Phase 3 answer style) ─────────────

type AuditPhase =
  | { name: "idle" }
  | { name: "running"; done: string[]; active: string }
  | { name: "done"; result: PortfolioAuditResult; stored?: boolean }
  | { name: "error"; message: string; code: "auth" | "limit" | "other" };

// ── Live data shapes (from /api/portfolio/live) ──────────────────────────────

interface LiveResponse {
  portfolio: { id: string; name: string; holdings: Holding[]; cash: number } | null;
  rows?: LiveHoldingRow[];
  totals?: LiveTotals;
  statsStrip?: LiveStatsStrip;
  latestAudit?: { healthScore: number; createdAt: string; result: PortfolioAuditResult } | null;
  error?: string;
  code?: string;
}

interface WatchItem {
  ticker: string;
  companyName: string | null;
  verdict: string | null;
  nextEarningsDate: string | null;
  price: number | null;
  changePct: number | null;
  freshnessLabel: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PortfolioSurface({
  initialTab,
  signedIn,
  lessons,
}: {
  initialTab: "holdings" | "watching";
  signedIn: boolean;
  lessons: StatLessonMap;
}) {
  const [tab, setTab] = useState<"holdings" | "watching">(initialTab);

  const switchTab = useCallback((next: "holdings" | "watching") => {
    setTab(next);
    const url = next === "watching" ? "/portfolio?tab=watching" : "/portfolio";
    window.history.replaceState(null, "", url);
  }, []);

  if (!signedIn) {
    return (
      <div className="cvq-folio">
        <FolioHeader tab={tab} onTab={switchTab} />
        <Card padding="lg" className="cvq-errorcard">
          <h3 className="cvq-section-title">Sign in to build your portfolio</h3>
          <p>Track what you own and what you&rsquo;re watching, with live values and plain-English health stats.</p>
          <Link href="/login" className="cvq-btn cvq-btn--primary">Sign in</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="cvq-folio">
      <FolioHeader tab={tab} onTab={switchTab} />
      <div hidden={tab !== "holdings"}>
        <HoldingsTab lessons={lessons} />
      </div>
      <div hidden={tab !== "watching"}>
        <WatchingTab active={tab === "watching"} />
      </div>
      <p className="cvq-disclaimer">
        Conviqt is a research and education tool, not a licensed financial
        adviser. Nothing here is financial advice. Markets involve risk.
      </p>
    </div>
  );
}

function FolioHeader({
  tab,
  onTab,
}: {
  tab: "holdings" | "watching";
  onTab: (t: "holdings" | "watching") => void;
}) {
  return (
    <header className="cvq-folio-head">
      <h1 className="cvq-folio-h1">Portfolio</h1>
      <div className="cvq-folio-tabs" role="tablist" aria-label="Portfolio sections">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "holdings"}
          className={`cvq-folio-tab ${tab === "holdings" ? "cvq-folio-tab--active" : ""}`}
          onClick={() => onTab("holdings")}
        >
          Holdings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "watching"}
          className={`cvq-folio-tab ${tab === "watching" ? "cvq-folio-tab--active" : ""}`}
          onClick={() => onTab("watching")}
        >
          Watching
        </button>
      </div>
    </header>
  );
}

// ── Stat ⓘ sheet — the app teaches what its numbers mean ────────────────────

function StatInfoSheet({
  statKey,
  value,
  lessons,
  onClose,
}: {
  statKey: StatKey | null;
  /** the user's own live value for this stat — null when unavailable */
  value: number | null;
  lessons: StatLessonMap;
  onClose: () => void;
}) {
  if (!statKey) return null;
  const info = STAT_INFO[statKey];
  const teaser = lessons[statKey];
  return (
    <Sheet open onClose={onClose} title={info.label}>
      <div className="cvq-folio-info">
        <p className="cvq-folio-info-what">{info.what}</p>
        {value !== null && <p className="cvq-folio-info-read">{info.interpret(value)}</p>}
        <div className="cvq-folio-info-how">
          <span className="cvq-folio-info-label">How we compute it</span>
          <p>{info.how}</p>
        </div>
        <div className="cvq-folio-info-lesson">
          <span className="cvq-folio-info-label">Go deeper in the Academy</span>
          <Link href={lessonHref(teaser.lessonId)} className="cvq-card cvq-card--interactive cvq-folio-lesson-card">
            <span className="cvq-folio-lesson-title">{teaser.title}</span>
            <span className="cvq-folio-lesson-hook">{teaser.hook}</span>
            <span className="cvq-folio-lesson-go">Open the lesson →</span>
          </Link>
        </div>
      </div>
    </Sheet>
  );
}

// ── Holdings tab ─────────────────────────────────────────────────────────────

function HoldingsTab({ lessons }: { lessons: StatLessonMap }) {
  const [infoStat, setInfoStat] = useState<StatKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<LiveResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Add/edit form
  const [query, setQuery] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Health check
  const [audit, setAudit] = useState<AuditPhase>({ name: "idle" });
  // Soft paywall (Phase 7): opens when the month's included deep analyses run out.
  const [paywallOpen, setPaywallOpen] = useState(false);
  const auditAbort = useRef<AbortController | null>(null);

  const holdings: Holding[] = useMemo(
    () => data?.portfolio?.holdings ?? [],
    [data]
  );
  const cash = data?.portfolio?.cash ?? 0;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio/live");
      const body: LiveResponse = await res.json();
      if (!res.ok) {
        setLoadError(body.error ?? "Could not load your portfolio right now.");
      } else {
        setData(body);
        setLoadError(null);
      }
    } catch (err) {
      console.error("[portfolio] live load failed:", err);
      setLoadError("Could not load your portfolio right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => () => auditAbort.current?.abort(), []);

  // One saver for both holdings and cash edits. `patch` carries only what's
  // changing; the rest is preserved from the current portfolio so a holdings
  // edit never wipes the cash balance and vice-versa.
  const save = useCallback(
    async (patch: { holdings?: Holding[]; cash?: number }, message: string) => {
      setSaving(true);
      setStatusMsg(null);
      try {
        const res = await fetch("/api/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: data?.portfolio?.id,
            name: data?.portfolio?.name ?? "My Portfolio",
            holdings: patch.holdings ?? data?.portfolio?.holdings ?? [],
            cash: patch.cash ?? data?.portfolio?.cash ?? 0,
          }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setStatusMsg(body?.error ?? "Could not save that change.");
          return false;
        }
        setStatusMsg(message);
        await load();
        return true;
      } catch (err) {
        console.error("[portfolio] save failed:", err);
        setStatusMsg("Could not save that change.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [data, load]
  );

  const saveCash = useCallback(
    async (next: number) => {
      const label = next > 0 ? `Cash set to ${fmtMoney(next)}.` : "Cash cleared.";
      return save({ cash: next }, label);
    },
    [save]
  );

  const submitForm = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError(null);
      const ticker = (editing ?? query).trim().toUpperCase();
      const sharesNum = Number(shares);
      const costNum = cost.trim() === "" ? undefined : Number(cost.replace(/[$,]/g, ""));
      if (!TICKER_RE.test(ticker)) {
        setFormError("Pick a ticker symbol first — try searching by company name.");
        return;
      }
      if (!Number.isFinite(sharesNum) || sharesNum <= 0) {
        setFormError("Shares must be a positive number.");
        return;
      }
      if (costNum !== undefined && (!Number.isFinite(costNum) || costNum <= 0)) {
        setFormError("Cost basis is the average price you paid per share — leave it blank if you don't know it.");
        return;
      }
      const updated: Holding = {
        ticker,
        shares: sharesNum,
        ...(costNum !== undefined ? { costBasis: costNum } : {}),
      };
      // Updates keep the holding's place in the table; only new tickers append.
      const exists = holdings.some((h) => h.ticker === ticker);
      if (!exists && holdings.length >= MAX_HOLDINGS) {
        setFormError(`That's the cap — ${MAX_HOLDINGS} holdings.`);
        return;
      }
      const next = exists
        ? holdings.map((h) => (h.ticker === ticker ? updated : h))
        : [...holdings, updated];
      const ok = await save({ holdings: next }, editing ? `Updated ${ticker}.` : `Added ${ticker}.`);
      if (ok) {
        setQuery("");
        setShares("");
        setCost("");
        setEditing(null);
      }
    },
    [query, shares, cost, editing, holdings, save]
  );

  const startEdit = useCallback((row: LiveHoldingRow) => {
    setEditing(row.ticker);
    setQuery(row.ticker);
    setShares(String(row.shares));
    setCost(row.costBasis !== null ? String(row.costBasis) : "");
    setFormError(null);
  }, []);

  const remove = useCallback(
    (ticker: string) => {
      void save(
        { holdings: holdings.filter((h) => h.ticker !== ticker) },
        `Removed ${ticker}.`
      );
    },
    [holdings, save]
  );

  const onCsvFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = parseHoldingsCsv(text);
      if (parsed.error) {
        setStatusMsg(parsed.error);
        return;
      }
      // Imported rows win over existing ones with the same ticker.
      const imported = new Set(parsed.holdings.map((h) => h.ticker));
      const merged = [
        ...holdings.filter((h) => !imported.has(h.ticker)),
        ...parsed.holdings,
      ].slice(0, MAX_HOLDINGS);
      const skippedNote = parsed.skipped > 0 ? ` ${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} couldn't be read.` : "";
      await save({ holdings: merged }, `Imported ${parsed.holdings.length} holding${parsed.holdings.length === 1 ? "" : "s"}.${skippedNote}`);
    },
    [holdings, save]
  );

  // ── Health check stream ────────────────────────────────────────────────────

  const runHealthCheck = useCallback(async () => {
    auditAbort.current?.abort();
    const controller = new AbortController();
    auditAbort.current = controller;

    let done: string[] = [];
    let active = "Pricing your holdings…";
    const push = () => setAudit({ name: "running", done: [...done], active });
    const advance = (label: string) => {
      if (active && active !== label) done = [...done, active];
      active = label;
      push();
    };
    push();

    let checksDone = 0;
    let result: PortfolioAuditResult | null = null;

    try {
      const res = await fetch("/api/portfolio/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: data?.portfolio?.id,
          name: data?.portfolio?.name ?? "My Portfolio",
          holdings,
          cash,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!contentType.includes("ndjson")) {
        const body = await res.json().catch(() => null);
        if (res.status === 401)
          return setAudit({ name: "error", message: "Sign in to run a health check.", code: "auth" });
        if (res.status === 402) {
          setPaywallOpen(true);
          return setAudit({ name: "error", message: body?.error ?? "You've hit this month's limit.", code: "limit" });
        }
        return setAudit({
          name: "error",
          message: body?.error ?? "The health check could not start. Try again in a moment.",
          code: "other",
        });
      }
      if (!res.body)
        return setAudit({ name: "error", message: "The connection dropped. Try again.", code: "other" });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done: eof, value } = await reader.read();
        if (eof) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let ev: Record<string, unknown>;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "audit") {
            const e = ev.event as { kind: string };
            if (e.kind === "sweep_done") advance("Running five risk checks…");
            if (e.kind === "agent_done") {
              checksDone += 1;
              if (checksDone >= 5) advance("Writing the verdict…");
              else advance(`Risk checks underway… (${checksDone} of 5 done)`);
            }
          } else if (ev.type === "audit_done") {
            result = ev.result as PortfolioAuditResult;
          } else if (ev.type === "error") {
            return setAudit({
              name: "error",
              message: (ev.error as string) || "The health check could not be completed.",
              code: "other",
            });
          }
        }
      }
      if (result) {
        setAudit({ name: "done", result });
        void load(); // pick up the freshly saved audit as "last check"
      } else {
        setAudit({ name: "error", message: "The run ended without a result. Try again in a moment.", code: "other" });
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      console.error("[portfolio] health check stream failed:", err);
      setAudit({ name: "error", message: "The connection dropped mid-run. Try again in a moment.", code: "other" });
    }
  }, [data, holdings, cash, load]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card padding="lg">
        <SkeletonText lines={4} />
      </Card>
    );
  }
  if (loadError) {
    return (
      <Card padding="lg" className="cvq-errorcard">
        <h3 className="cvq-section-title">That didn&rsquo;t load</h3>
        <p>{loadError}</p>
        <button type="button" className="cvq-btn cvq-btn--secondary" onClick={() => { setLoading(true); void load(); }}>
          Try again
        </button>
      </Card>
    );
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const strip = data?.statsStrip;
  const empty = holdings.length === 0;

  return (
    <div className="cvq-folio-holdings">
      <LensPanel portfolioId={data?.portfolio?.id ?? null} enabled={!empty} />
      {!empty && <RadarPanel portfolioId={data?.portfolio?.id ?? undefined} />}
      {empty ? (
        <Card padding="lg">
          <EmptyState
            title="What do you own?"
            body="Add your first holding below — search by ticker or company name — or import a CSV with columns: ticker, shares, cost basis."
          />
        </Card>
      ) : (
        <>
          {totals && <SummaryStrip totals={totals} />}
          {strip && <StatsStrip strip={strip} onInfo={setInfoStat} />}
          <HoldingsTable rows={rows} onEdit={startEdit} onRemove={remove} saving={saving} />
        </>
      )}

      <CashEditor cash={cash} onSave={(n) => void saveCash(n)} saving={saving} />

      <form className="cvq-folio-add" onSubmit={submitForm}>
        <div className="cvq-folio-add-fields">
          <label className="cvq-field cvq-folio-add-ticker">
            <span>{editing ? "Holding" : "Ticker or company"}</span>
            {editing ? (
              <input type="text" className="cvq-folio-search-input" value={editing} disabled aria-label="Ticker being edited" />
            ) : (
              <TickerSearch
                value={query}
                onChange={setQuery}
                onPick={setQuery}
                placeholder="NVDA or Nvidia"
                ariaLabel="Search for a ticker to add"
              />
            )}
          </label>
          <label className="cvq-field">
            <span>Shares</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              className="cvq-folio-num-input"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="10"
              aria-label="Number of shares"
            />
          </label>
          <label className="cvq-field">
            <span>Cost basis <em>(optional)</em></span>
            <input
              type="text"
              inputMode="decimal"
              className="cvq-folio-num-input"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="$ per share"
              aria-label="Average cost per share, optional"
            />
          </label>
          <div className="cvq-folio-add-actions">
            <button type="submit" className="cvq-btn cvq-btn--primary" disabled={saving}>
              {editing ? `Update ${editing}` : "Add holding"}
            </button>
            {editing && (
              <button
                type="button"
                className="cvq-btn cvq-btn--ghost"
                onClick={() => {
                  setEditing(null);
                  setQuery("");
                  setShares("");
                  setCost("");
                  setFormError(null);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {formError && <p className="cvq-folio-msg" role="alert">{formError}</p>}
        <div className="cvq-folio-csvrow">
          <button
            type="button"
            className="cvq-btn cvq-btn--secondary"
            onClick={() => fileRef.current?.click()}
            disabled={saving}
          >
            Import CSV
          </button>
          <span className="cvq-folio-csvhint">Columns: ticker, shares, cost basis (optional). Header row optional.</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/tab-separated-values,.tsv,.txt"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onCsvFile(f);
              e.target.value = "";
            }}
          />
        </div>
        {statusMsg && <p className="cvq-folio-msg" role="status">{statusMsg}</p>}
      </form>

      <HealthCheckSection
        audit={audit}
        canRun={holdings.length >= 2}
        running={audit.name === "running"}
        lastAudit={data?.latestAudit ?? null}
        onRun={() => void runHealthCheck()}
        onViewLast={() => {
          if (data?.latestAudit) setAudit({ name: "done", result: data.latestAudit.result, stored: true });
        }}
        onDismiss={() => setAudit({ name: "idle" })}
      />

      <PaywallSheet open={paywallOpen} onClose={() => setPaywallOpen(false)} />

      <StatInfoSheet
        statKey={infoStat}
        value={
          infoStat && strip?.stats
            ? {
                beta: strip.stats.beta,
                volatility: strip.stats.volatilityPct,
                maxDrawdown: strip.stats.maxDrawdownPct,
                sharpe: strip.stats.sharpe,
              }[infoStat]
            : null
        }
        lessons={lessons}
        onClose={() => setInfoStat(null)}
      />
    </div>
  );
}

// ── Cash editor ──────────────────────────────────────────────────────────────
// A small control for the uninvested cash a user holds. It feeds the headline
// Total value and the AI Health Check (where it reads as a zero-risk buffer).

function CashEditor({
  cash,
  onSave,
  saving,
}: {
  cash: number;
  onSave: (n: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setValue(cash > 0 ? String(cash) : "");
    setError(null);
    setEditing(true);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim().replace(/[$,]/g, "");
    const n = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      setError("Enter a dollar amount, or 0 to clear it.");
      return;
    }
    onSave(Math.round(n * 100) / 100);
    setEditing(false);
  };

  return (
    <Card padding="lg" className="cvq-folio-cash">
      <div className="cvq-folio-cash-head">
        <div className="cvq-folio-cash-intro">
          <span className="cvq-folio-summary-label">Cash in account</span>
          <p className="cvq-folio-cash-sub">
            Uninvested money you&rsquo;re holding. It counts toward your total value and your AI Health Check.
          </p>
        </div>
        {!editing && (
          <div className="cvq-folio-cash-readout">
            <span className="cvq-folio-cash-value">{cash > 0 ? fmtMoney(cash) : "—"}</span>
            <button
              type="button"
              className="cvq-btn cvq-btn--secondary"
              onClick={open}
              disabled={saving}
            >
              {cash > 0 ? "Edit" : "Add cash"}
            </button>
          </div>
        )}
      </div>
      {editing && (
        <form className="cvq-folio-cash-form" onSubmit={submit}>
          <div className="cvq-folio-cash-inputwrap">
            <span className="cvq-folio-cash-dollar" aria-hidden>$</span>
            <input
              type="text"
              inputMode="decimal"
              className="cvq-folio-num-input cvq-folio-cash-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="13,000"
              aria-label="Cash amount in dollars"
              autoFocus
            />
          </div>
          <div className="cvq-folio-add-actions">
            <button type="submit" className="cvq-btn cvq-btn--primary" disabled={saving}>
              Save cash
            </button>
            <button
              type="button"
              className="cvq-btn cvq-btn--ghost"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
          {error && <p className="cvq-folio-msg" role="alert">{error}</p>}
        </form>
      )}
    </Card>
  );
}

// ── Summary + stats strips ───────────────────────────────────────────────────

function SummaryStrip({ totals }: { totals: LiveTotals }) {
  const hasValue = totals.pricedCount > 0;
  const hasCash = totals.cash > 0;
  return (
    <Card raised padding="lg" className="cvq-folio-summary">
      <div className="cvq-folio-summary-main">
        <span className="cvq-folio-summary-label">Total value</span>
        {/* $0.00 would read as "your portfolio is worth nothing"; when nothing
            could be priced AND there's no cash, say so honestly. Cash alone is
            still a real total. */}
        {hasValue || hasCash ? (
          <span className="cvq-folio-summary-value">
            {fmtMoney(totals.totalWithCash)}
          </span>
        ) : (
          <span className="cvq-quote-unavailable">Live values unavailable right now</span>
        )}
        {/* Split out invested vs. cash so the headline total is never a mystery. */}
        {hasCash && (
          <span className="cvq-folio-summary-split">
            {hasValue ? `${fmtMoney(totals.value)} invested` : "Nothing invested yet"}
            {" · "}
            {fmtMoney(totals.cash)} cash
          </span>
        )}
        {totals.freshnessLabel && (
          <span className="cvq-quote-fresh">{totals.freshnessLabel}</span>
        )}
      </div>
      {totals.pricedCount > 0 && (
        <div className="cvq-folio-summary-pls">
          <div className="cvq-folio-summary-pl">
            <span className="cvq-folio-summary-label">Today</span>
            {totals.dayPL !== null ? (
              <span className="cvq-folio-summary-plrow">
                <ChangePill change={totals.dayPLPct ?? 0} />
                <ChangeText change={totals.dayPL} label={fmtMoneyAbs(totals.dayPL)} />
              </span>
            ) : (
              <span className="cvq-quote-unavailable">unavailable right now</span>
            )}
          </div>
          <div className="cvq-folio-summary-pl">
            <span className="cvq-folio-summary-label">All time</span>
            {totals.totalPL !== null ? (
              <span className="cvq-folio-summary-plrow">
                <ChangePill change={totals.totalPLPct ?? 0} />
                <ChangeText change={totals.totalPL} label={fmtMoneyAbs(totals.totalPL)} />
              </span>
            ) : (
              <span className="cvq-folio-summary-note">Add cost basis to see it</span>
            )}
          </div>
        </div>
      )}
      {totals.unpricedCount > 0 && (
        <p className="cvq-folio-summary-note">
          {totals.unpricedCount} holding{totals.unpricedCount === 1 ? "" : "s"} couldn&rsquo;t be priced right now and {totals.unpricedCount === 1 ? "isn’t" : "aren’t"} in these totals.
        </p>
      )}
    </Card>
  );
}

function StatsStrip({
  strip,
  onInfo,
}: {
  strip: LiveStatsStrip;
  onInfo: (k: StatKey) => void;
}) {
  const s = strip.stats;
  const values: Record<StatKey, number | null> = {
    beta: s?.beta ?? null,
    volatility: s?.volatilityPct ?? null,
    maxDrawdown: s?.maxDrawdownPct ?? null,
    sharpe: s?.sharpe ?? null,
  };
  return (
    <section className="cvq-folio-statsec" aria-label="Portfolio statistics">
      <div className="cvq-folio-stats">
        {STAT_KEYS.map((key) => {
          const info = STAT_INFO[key];
          const v = values[key];
          return (
            <StatTile
              key={key}
              label={info.label}
              value={v !== null ? <span>{info.format(v)}</span> : "—"}
              sub={key === "beta" ? "vs the S&P 500" : key === "sharpe" ? "risk-adjusted return" : "past year"}
              onInfo={() => onInfo(key)}
              infoLabel={`What does ${info.label} mean?`}
            />
          );
        })}
      </div>
      <p className="cvq-folio-stats-note">
        {s
          ? `Computed from the past year of daily closes vs the S&P 500 (${strip.benchmark}), over ${s.observations} sessions${
              strip.holdingsUsed < strip.holdingsTotal
                ? ` — covers ${strip.holdingsUsed} of ${strip.holdingsTotal} holdings (the rest lack price history)`
                : ""
            }. Tap ⓘ to see what each number means.`
          : strip.reason ?? "Statistics are unavailable right now."}
      </p>
    </section>
  );
}

// ── Holdings table ───────────────────────────────────────────────────────────

function HoldingsTable({
  rows,
  onEdit,
  onRemove,
  saving,
}: {
  rows: LiveHoldingRow[];
  onEdit: (r: LiveHoldingRow) => void;
  onRemove: (ticker: string) => void;
  saving: boolean;
}) {
  return (
    <Card padding="none" className="cvq-folio-tablecard">
      <div className="cvq-folio-table" role="table" aria-label="Your holdings">
        <div className="cvq-folio-row cvq-folio-row--head" role="row">
          <span role="columnheader">Holding</span>
          <span role="columnheader" className="cvq-folio-cell--num">Shares</span>
          <span role="columnheader" className="cvq-folio-cell--num">Cost basis</span>
          <span role="columnheader" className="cvq-folio-cell--num">Price</span>
          <span role="columnheader" className="cvq-folio-cell--num">Today</span>
          <span role="columnheader" className="cvq-folio-cell--num">Value</span>
          <span role="columnheader" className="cvq-folio-cell--num">Total P/L</span>
          <span role="columnheader" className="cvq-folio-cell--actions" aria-label="Actions" />
        </div>
        {rows.map((r) => (
          <div key={r.ticker} className="cvq-folio-row" role="row">
            <span role="cell" className="cvq-folio-cell--id">
              <span className="cvq-ticker-sym">{r.ticker}</span>
              {r.companyName && <span className="cvq-folio-cell-name">{r.companyName}</span>}
            </span>
            <span role="cell" className="cvq-folio-cell--num" data-label="Shares">
              {fmtShares(r.shares)}
            </span>
            <span role="cell" className="cvq-folio-cell--num" data-label="Cost basis">
              {r.costBasis !== null ? fmtMoney(r.costBasis) : "—"}
            </span>
            <span role="cell" className="cvq-folio-cell--num" data-label="Price">
              {r.price !== null ? fmtMoney(r.price) : <span title="Data unavailable right now">—</span>}
            </span>
            <span role="cell" className="cvq-folio-cell--num" data-label="Today">
              {r.changePct !== null ? <ChangePill change={r.changePct} /> : "—"}
              {r.dayPL !== null && (
                <span className="cvq-folio-cell-sub">
                  <ChangeText change={r.dayPL} label={fmtMoneyAbs(r.dayPL)} />
                </span>
              )}
            </span>
            <span role="cell" className="cvq-folio-cell--num" data-label="Value">
              {r.value !== null ? fmtMoney(r.value) : "—"}
            </span>
            <span role="cell" className="cvq-folio-cell--num" data-label="Total P/L">
              {r.totalPL !== null ? (
                <>
                  <ChangeText change={r.totalPL} label={fmtMoneyAbs(r.totalPL)} />
                  {r.totalPLPct !== null && (
                    <span className="cvq-folio-cell-sub cvq-folio-cell-muted">{fmtPctAbs(r.totalPLPct)}</span>
                  )}
                </>
              ) : (
                <span title={r.costBasis === null ? "Add a cost basis to see profit and loss" : undefined}>—</span>
              )}
            </span>
            <span role="cell" className="cvq-folio-cell--actions">
              <button
                type="button"
                className="cvq-folio-rowbtn"
                onClick={() => onEdit(r)}
                disabled={saving}
                aria-label={`Edit ${r.ticker}`}
                title="Edit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                className="cvq-folio-rowbtn"
                onClick={() => onRemove(r.ticker)}
                disabled={saving}
                aria-label={`Remove ${r.ticker}`}
                title="Remove"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── AI Health Check ──────────────────────────────────────────────────────────

function HealthCheckSection({
  audit,
  canRun,
  running,
  lastAudit,
  onRun,
  onViewLast,
  onDismiss,
}: {
  audit: AuditPhase;
  canRun: boolean;
  running: boolean;
  lastAudit: { healthScore: number; createdAt: string; result: PortfolioAuditResult } | null;
  onRun: () => void;
  onViewLast: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="cvq-folio-health" aria-label="AI Health Check">
      <div className="cvq-folio-health-head">
        <div>
          <h2 className="cvq-folio-h2">AI Health Check</h2>
          <p className="cvq-folio-health-sub">
            Stress-test what you own — five risk checks and a plain-English read on where this portfolio is fragile.
          </p>
        </div>
        <button
          type="button"
          className="cvq-btn cvq-btn--primary"
          onClick={onRun}
          disabled={!canRun || running}
        >
          {running ? "Checking…" : "Run AI Health Check"}
        </button>
      </div>
      {!canRun && (
        <p className="cvq-folio-msg">Add at least 2 holdings to run a health check.</p>
      )}
      {audit.name === "idle" && lastAudit && (
        <p className="cvq-folio-msg">
          Last check: {lastAudit.result.judge.healthGrade} ({lastAudit.healthScore}/100), {timeAgoLabel(lastAudit.createdAt)}.{" "}
          <button type="button" className="cvq-folio-linkbtn" onClick={onViewLast}>
            View it
          </button>
        </p>
      )}

      {audit.name === "running" && (
        <Card padding="lg" className="cvq-progress" aria-live="polite">
          {audit.done.map((line, i) => (
            <div key={i} className="cvq-progress-line cvq-progress-line--done">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {line}
            </div>
          ))}
          <div className="cvq-progress-line cvq-progress-line--active">
            <span className="cvq-progress-dot" aria-hidden />
            {audit.active}
          </div>
          <SkeletonText lines={2} />
        </Card>
      )}

      {audit.name === "error" && (
        <Card padding="lg" className="cvq-errorcard">
          {audit.code === "limit" ? (
            <>
              <h3 className="cvq-section-title">You&apos;ve hit this month&apos;s limit</h3>
              <p>{audit.message}</p>
              <Link href="/pricing" className="cvq-btn cvq-btn--primary">See what Pro unlocks</Link>
            </>
          ) : audit.code === "auth" ? (
            <>
              <h3 className="cvq-section-title">Sign in to run a health check</h3>
              <Link href="/login" className="cvq-btn cvq-btn--primary">Sign in</Link>
            </>
          ) : (
            <>
              <h3 className="cvq-section-title">That didn&apos;t work</h3>
              <p>{audit.message}</p>
              <button type="button" className="cvq-btn cvq-btn--secondary" onClick={onDismiss}>
                Dismiss
              </button>
            </>
          )}
        </Card>
      )}

      {audit.name === "done" && (
        <div className="cvq-folio-health-result">
          {audit.stored && (
            <p className="cvq-folio-msg">
              Your most recent saved check{" "}
              <button type="button" className="cvq-folio-linkbtn" onClick={onDismiss}>hide</button>
            </p>
          )}
          <AuditAnswer result={audit.result} />
          <p className="cvq-disclaimer">
            Conviqt is a research and education tool, not a licensed financial adviser. Nothing here is financial advice. Markets involve risk.
          </p>
        </div>
      )}
    </section>
  );
}

// ── Watching tab ─────────────────────────────────────────────────────────────

function WatchingTab({ active }: { active: boolean }) {
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [items, setItems] = useState<WatchItem[]>([]);
  const [max, setMax] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.status === 401) {
        setAuthNeeded(true);
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        setError("Your watching list didn't load. Try again in a moment.");
        return;
      }
      setItems(body.items ?? []);
      setMax(body.max ?? 10);
      setError(null);
    } catch (err) {
      console.error("[portfolio] watching load failed:", err);
      setError("Your watching list didn't load. Try again in a moment.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (active && !loaded) void load();
  }, [active, loaded, load]);

  const mutate = useCallback(
    async (method: "POST" | "DELETE", ticker: string) => {
      setBusy(true);
      setMsg(null);
      try {
        const res = await fetch("/api/watchlist", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setMsg(
            body?.message ??
              (body?.error === "invalid_ticker"
                ? "That doesn't look like a ticker symbol."
                : "That didn't work. Try again in a moment.")
          );
          return;
        }
        setItems(body.items ?? []);
        setMax(body.max ?? 10);
        if (method === "POST") setQuery("");
      } catch (err) {
        console.error("[portfolio] watching update failed:", err);
        setMsg("That didn't work. Try again in a moment.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  if (authNeeded) {
    return (
      <Card padding="lg" className="cvq-errorcard">
        <h3 className="cvq-section-title">Sign in to keep a watching list</h3>
        <Link href="/login" className="cvq-btn cvq-btn--primary">Sign in</Link>
      </Card>
    );
  }
  if (loading) {
    return (
      <Card padding="lg">
        <SkeletonText lines={3} />
      </Card>
    );
  }
  if (error) {
    return (
      <Card padding="lg" className="cvq-errorcard">
        <h3 className="cvq-section-title">That didn&rsquo;t load</h3>
        <p>{error}</p>
        <button type="button" className="cvq-btn cvq-btn--secondary" onClick={() => { setLoading(true); void load(); }}>
          Try again
        </button>
      </Card>
    );
  }

  return (
    <div className="cvq-folio-watching">
      {items.length === 0 ? (
        <Card padding="lg">
          <EmptyState
            title="Nothing on your radar yet"
            body="Add tickers you want to keep an eye on. We'll email you when one of them is about to report earnings."
          />
        </Card>
      ) : (
        <Card padding="none" className="cvq-folio-tablecard">
          <ul className="cvq-folio-watchlist">
            {items.map((it) => (
              <li key={it.ticker} className="cvq-folio-watchrow">
                <div className="cvq-folio-watchid">
                  <span className="cvq-ticker-sym">{it.ticker}</span>
                  {it.companyName && <span className="cvq-folio-cell-name">{it.companyName}</span>}
                </div>
                <div className="cvq-folio-watchquote">
                  {it.price !== null ? (
                    <>
                      <span className="cvq-ticker-price">{fmtMoney(it.price)}</span>
                      {it.changePct !== null && <ChangePill change={it.changePct} />}
                    </>
                  ) : (
                    <span className="cvq-quote-unavailable">price unavailable</span>
                  )}
                </div>
                <div className="cvq-folio-watchmeta">
                  {it.nextEarningsDate && (
                    <span className="cvq-pill cvq-pill--flat">Earnings {it.nextEarningsDate}</span>
                  )}
                </div>
                <div className="cvq-folio-watchactions">
                  <Link
                    href={`/research?skill=quick-take&ticker=${encodeURIComponent(it.ticker)}`}
                    className="cvq-btn cvq-btn--ghost"
                  >
                    Look into it →
                  </Link>
                  <button
                    type="button"
                    className="cvq-folio-rowbtn"
                    onClick={() => void mutate("DELETE", it.ticker)}
                    disabled={busy}
                    aria-label={`Stop watching ${it.ticker}`}
                    title="Stop watching"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form
        className="cvq-folio-add"
        onSubmit={(e) => {
          e.preventDefault();
          const t = query.trim().toUpperCase();
          if (TICKER_RE.test(t)) void mutate("POST", t);
          else setMsg("Pick a ticker symbol first — try searching by company name.");
        }}
      >
        <div className="cvq-folio-add-fields">
          <label className="cvq-field cvq-folio-add-ticker">
            <span>Watch a stock</span>
            <TickerSearch
              value={query}
              onChange={setQuery}
              onPick={setQuery}
              placeholder="AAPL or Apple"
              universeOnly
              ariaLabel="Search for a ticker to watch"
            />
          </label>
          <div className="cvq-folio-add-actions">
            <button type="submit" className="cvq-btn cvq-btn--primary" disabled={busy || items.length >= max}>
              Watch it
            </button>
          </div>
        </div>
        <p className="cvq-folio-csvhint">
          {`${items.length} of ${max} — we’ll email you when one of these is about to report earnings. Dates can shift; confirm with the company before trading.`}
        </p>
        {msg && <p className="cvq-folio-msg" role="alert">{msg}</p>}
      </form>
    </div>
  );
}
