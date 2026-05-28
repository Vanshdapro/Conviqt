import Link from "next/link";
import type { AlphaPick, AlphaPickSource } from "@/lib/alphaTypes";
import { getAlphaStore } from "@/lib/alphaStore";
import { DashNav } from "@/components/DashNav";

// Never statically prerender — picks change at runtime.
export const dynamic = "force-dynamic";

interface PicksData {
  active: AlphaPick[];
  recently_exited: AlphaPick[];
  last_run: string | null;
}

async function fetchPicks(): Promise<PicksData> {
  try {
    const store = getAlphaStore();
    const [active, recently_exited, last_run] = await Promise.all([
      store.fetchActive(),
      store.fetchRecentlySold(60),
      store.lastRunDate(),
    ]);
    return { active, recently_exited, last_run };
  } catch {
    return { active: [], recently_exited: [], last_run: null };
  }
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function ConvictionBar({ conviction }: { conviction: number }) {
  const filled = Math.max(0, Math.min(10, conviction));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i < filled
                ? `rgba(79, 135, 247, ${0.28 + (i / 10) * 0.72})`
                : "rgba(79,135,247,0.08)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.4)", letterSpacing: "0.08em" }}>
        {conviction}/10 conviction
      </span>
    </div>
  );
}

function PriceChange({ pick }: { pick: AlphaPick }) {
  const changePct = pick.price_change_pct;
  const currentPrice = pick.current_price;

  if (currentPrice == null || changePct == null) return null;

  const isUp = changePct >= 0;
  const color = isUp ? "#22c55e" : "#ef4444";
  const sign = isUp ? "+" : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color, letterSpacing: "-0.5px" }}>
        {sign}{changePct.toFixed(2)}%
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(232,237,248,0.45)", marginTop: 1 }}>
        ${currentPrice.toFixed(2)} now
      </div>
      {pick.price_last_updated && (
        <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 2 }}>
          Updated {formatDate(pick.price_last_updated)}
        </div>
      )}
    </div>
  );
}

function SourceCitations({ sources }: { sources: AlphaPickSource[] }) {
  function domain(url: string): string {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url.slice(0, 30); }
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {sources.map((s, i) => (
        <a
          key={i}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          title={s.title}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(232,237,248,0.35)",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          [{i + 1}] {domain(s.url)}
        </a>
      ))}
    </div>
  );
}

function PickCard({ pick, index = 0 }: { pick: AlphaPick; index?: number }) {
  const upside = pick.entry_price > 0
    ? (((pick.target_price - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
    : null;
  const downside = pick.entry_price > 0
    ? (((pick.stop_loss - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
    : null;

  return (
    <article className="pick-card" style={{
      background: "rgba(10,19,35,0.7)",
      border: "1px solid rgba(232,237,248,0.08)",
      borderLeft: "2px solid rgba(79,135,247,0.5)",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      animation: "slide-up 0.28s ease-out both",
      animationDelay: `${index * 0.06}s`,
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(232,237,248,0.06)",
        background: "rgba(232,237,248,0.02)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 28, color: "#e8edf8", letterSpacing: "-1px", lineHeight: 1 }}>
            {pick.ticker}
          </div>
          <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.5)", marginTop: 3 }}>
            {pick.company_name}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.3)", marginTop: 6 }}>
            Entry ${pick.entry_price.toFixed(2)} · {formatDate(pick.entry_date)}
          </div>
        </div>
        <PriceChange pick={pick} />
      </div>

      {/* Catalyst */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "rgba(110,182,255,0.7)", textTransform: "uppercase", marginBottom: 6 }}>
          Catalyst
        </div>
        <div style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.85)", lineHeight: 1.6 }}>
          {pick.catalyst}
        </div>
      </div>

      {/* Price targets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <div style={{ padding: "12px 20px", borderRight: "1px solid rgba(232,237,248,0.05)" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Target</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#22c55e", fontWeight: 600 }}>${pick.target_price.toFixed(2)}</div>
          {upside && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(34,197,94,0.6)", marginTop: 2 }}>+{upside}%</div>}
        </div>
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.35)", textTransform: "uppercase", marginBottom: 5 }}>Stop</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "rgba(232,237,248,0.5)", fontWeight: 500 }}>${pick.stop_loss.toFixed(2)}</div>
          {downside && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(232,237,248,0.3)", marginTop: 2 }}>{downside}%</div>}
        </div>
      </div>

      {/* Conviction */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <ConvictionBar conviction={pick.conviction} />
      </div>

      {/* Bull case */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(34,197,94,0.6)", textTransform: "uppercase", marginBottom: 6 }}>
          Bull case
        </div>
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.7)", lineHeight: 1.65, margin: 0 }}>
          {pick.bull_thesis}
        </p>
      </div>

      {/* Bear case */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(232,237,248,0.05)", boxShadow: "inset 3px 0 0 rgba(245,158,11,0.35)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(245,158,11,0.65)", textTransform: "uppercase", marginBottom: 6 }}>
          Bear case
        </div>
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.6)", lineHeight: 1.65, margin: 0 }}>
          {pick.bear_thesis}
        </p>
      </div>

      {/* Sources */}
      {pick.sources && pick.sources.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(232,237,248,0.25)", textTransform: "uppercase", marginBottom: 6 }}>
            Sources
          </div>
          <SourceCitations sources={pick.sources} />
        </div>
      )}
    </article>
  );
}

export default async function AlphaPage() {
  const { active, recently_exited, last_run } = await fetchPicks();

  return (
    <div style={{ minHeight: "100vh", background: "#050d1a" }}>
      <DashNav active="alpha" />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>

        {/* Page header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ height: 1, width: 32, background: "rgba(232,237,248,0.2)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.45)" }}>
              Alpha Tracker
            </span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 600,
            fontSize: "clamp(32px, 4vw, 52px)",
            letterSpacing: "-0.02em",
            color: "#e8edf8",
            margin: "0 0 12px",
            lineHeight: 1.1,
          }}>
            Active Positions
          </h1>
          <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 15, color: "rgba(232,237,248,0.55)", margin: 0, lineHeight: 1.7 }}>
            Full thesis for every pick. Price changes updated each run. Losses published alongside wins.
          </p>
          {last_run && (
            <div style={{ marginTop: 16 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.35)", background: "rgba(232,237,248,0.04)", border: "1px solid rgba(232,237,248,0.08)", borderRadius: 6, padding: "4px 10px" }}>
                Last updated: {last_run}
              </span>
            </div>
          )}
        </div>

        {/* Active picks */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.4)", marginBottom: 20 }}>
            Active ({active.length})
          </div>

          {active.length === 0 ? (
            <div style={{
              background: "rgba(10,19,35,0.5)",
              border: "1px solid rgba(232,237,248,0.07)",
              borderRadius: 14,
              padding: "56px 48px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 14,
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" style={{ color: "rgba(79,135,247,0.28)" }}>
                <path d="M2 20h20M6 20V10M10 20V4M14 20V8M18 20V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 14, color: "rgba(232,237,248,0.5)", margin: "0 0 4px" }}>
                  No active positions at this time.
                </p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.25)", margin: 0, letterSpacing: "0.04em" }}>
                  Check back after the next research run.
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
              {active.map((pick, i) => (
                <PickCard key={pick.id ?? pick.ticker} pick={pick} index={i} />
              ))}
            </div>
          )}
        </section>

        {/* Recently exited */}
        {recently_exited.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(232,237,248,0.3)", marginBottom: 16 }}>
              Recently Exited
            </div>
            <div style={{
              background: "rgba(10,19,35,0.5)",
              border: "1px solid rgba(232,237,248,0.07)",
              borderRadius: 14,
              overflow: "hidden",
            }}>
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(232,237,248,0.06)", background: "rgba(232,237,248,0.02)" }}>
                    {["Ticker", "Company", "Added", "Exited", "Reason"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(232,237,248,0.3)", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recently_exited.map((pick, i) => (
                    <tr key={pick.id ?? i} style={{ borderBottom: "1px solid rgba(232,237,248,0.04)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8edf8" }}>{pick.ticker}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: 13, color: "rgba(232,237,248,0.55)" }}>{pick.company_name}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.3)" }}>{formatDate(pick.entry_date)}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(232,237,248,0.3)" }}>
                        {pick.exit_date ? formatDate(pick.exit_date) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.45)", maxWidth: 280 }}>
                        {pick.exit_reason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: 12, color: "rgba(232,237,248,0.3)", lineHeight: 1.8, fontStyle: "italic" }}>
          Paper-trading exercise for educational purposes only. Nothing published here constitutes investment advice.
          Every number has a source URL. The full track record, wins and losses, is published without omission.
        </p>
      </main>
    </div>
  );
}
