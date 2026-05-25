import Link from "next/link";
import Image from "next/image";
import type { AlphaPick, AlphaPickSource } from "@/lib/alphaTypes";
import { getAlphaStore } from "@/lib/alphaStore";

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
                ? `rgba(79, 135, 247, ${0.4 + (i / 10) * 0.6})`
                : "rgba(79,135,247,0.1)",
              transition: "background 0.2s",
            }}
          />
        ))}
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(122,146,184,0.6)", letterSpacing: "0.08em" }}>
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
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "rgba(122,146,184,0.7)", marginTop: 1 }}>
        ${currentPrice.toFixed(2)} now
      </div>
      {pick.price_last_updated && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "rgba(61,82,120,0.8)", marginTop: 2 }}>
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
            color: "rgba(122,146,184,0.5)",
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

function PickCard({ pick }: { pick: AlphaPick }) {
  const upside = pick.entry_price > 0
    ? (((pick.target_price - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
    : null;
  const downside = pick.entry_price > 0
    ? (((pick.stop_loss - pick.entry_price) / pick.entry_price) * 100).toFixed(1)
    : null;

  return (
    <article style={{
      background: "rgba(10,19,35,0.7)",
      backdropFilter: "blur(16px)",
      border: "1px solid rgba(79,135,247,0.12)",
      borderLeft: "3px solid #4f87f7",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid rgba(79,135,247,0.1)",
        background: "rgba(79,135,247,0.03)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 28, color: "#e8edf8", letterSpacing: "-1px", lineHeight: 1 }}>
            {pick.ticker}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(122,146,184,0.7)", marginTop: 3 }}>
            {pick.company_name}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(61,82,120,0.9)", marginTop: 6 }}>
            Entry ${pick.entry_price.toFixed(2)} · {formatDate(pick.entry_date)}
          </div>
        </div>
        <PriceChange pick={pick} />
      </div>

      {/* Catalyst */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(79,135,247,0.08)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", color: "#4f87f7", textTransform: "uppercase", marginBottom: 6 }}>
          Catalyst
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(232,237,248,0.85)", fontWeight: 500, lineHeight: 1.5 }}>
          {pick.catalyst}
        </div>
      </div>

      {/* Price targets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid rgba(79,135,247,0.08)" }}>
        <div style={{ padding: "12px 20px", borderRight: "1px solid rgba(79,135,247,0.08)" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(122,146,184,0.5)", textTransform: "uppercase", marginBottom: 5 }}>Target</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#22c55e", fontWeight: 600 }}>${pick.target_price.toFixed(2)}</div>
          {upside && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(34,197,94,0.6)", marginTop: 2 }}>+{upside}%</div>}
        </div>
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(122,146,184,0.5)", textTransform: "uppercase", marginBottom: 5 }}>Stop</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "rgba(122,146,184,0.7)", fontWeight: 500 }}>${pick.stop_loss.toFixed(2)}</div>
          {downside && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(122,146,184,0.4)", marginTop: 2 }}>{downside}%</div>}
        </div>
      </div>

      {/* Conviction */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(79,135,247,0.08)" }}>
        <ConvictionBar conviction={pick.conviction} />
      </div>

      {/* Bull case */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(79,135,247,0.08)" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "#22c55e", textTransform: "uppercase", marginBottom: 6 }}>
          Bull case
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(122,146,184,0.8)", lineHeight: 1.6, margin: 0 }}>
          {pick.bull_thesis}
        </p>
      </div>

      {/* Bear case */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(79,135,247,0.08)", borderLeft: "3px solid #f59e0b", marginLeft: -3 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "#f59e0b", textTransform: "uppercase", marginBottom: 6 }}>
          Bear case
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(245,158,11,0.75)", lineHeight: 1.6, margin: 0 }}>
          {pick.bear_thesis}
        </p>
      </div>

      {/* Sources */}
      {pick.sources && pick.sources.length > 0 && (
        <div style={{ padding: "12px 20px" }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", color: "rgba(61,82,120,0.8)", textTransform: "uppercase", marginBottom: 6 }}>
            Sources
          </div>
          <SourceCitations sources={pick.sources} />
        </div>
      )}
    </article>
  );
}

// ── Dashboard nav shared component ─────────────────────────────────────────

function DashNav({ active }: { active: "chat" | "alpha" | "methodology" }) {
  return (
    <header style={{ borderBottom: "1px solid rgba(79,135,247,0.1)", background: "rgba(6,12,24,0.95)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <Image src="/logo1.png" alt="Conviqt" width={24} height={24} style={{ objectFit: "contain" }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, color: "#e8edf8", letterSpacing: "-0.4px" }}>Conviqt</span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {([
            { label: "Research", href: "/chat", key: "chat" },
            { label: "Alpha Tracker", href: "/alpha", key: "alpha" },
            { label: "Methodology", href: "/methodology", key: "methodology" },
          ] as const).map(({ label, href, key }) => (
            <Link
              key={key}
              href={href}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: key === active ? 600 : 400,
                fontSize: 13,
                color: key === active ? "#4f87f7" : "rgba(122,146,184,0.65)",
                padding: "6px 14px",
                borderRadius: 7,
                textDecoration: "none",
                borderBottom: key === active ? "2px solid #4f87f7" : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{ height: 1, width: 32, background: "rgba(79,135,247,0.4)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4f87f7" }}>
              Alpha Tracker
            </span>
          </div>
          <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-2px", color: "#e8edf8", margin: "0 0 10px" }}>
            Active Positions
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: "rgba(122,146,184,0.75)", margin: 0, lineHeight: 1.6 }}>
            Full thesis for every pick. Price changes updated each run. Losses published alongside wins.
          </p>
          {last_run && (
            <div style={{ marginTop: 16 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(61,82,120,0.9)", background: "rgba(79,135,247,0.06)", border: "1px solid rgba(79,135,247,0.12)", borderRadius: 6, padding: "4px 10px" }}>
                Last updated: {last_run}
              </span>
            </div>
          )}
        </div>

        {/* Active picks */}
        <section style={{ marginBottom: 64 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4f87f7", marginBottom: 20 }}>
            Active ({active.length})
          </div>

          {active.length === 0 ? (
            <div style={{
              background: "rgba(10,19,35,0.5)",
              border: "1px solid rgba(79,135,247,0.1)",
              borderRadius: 14,
              padding: 48,
              textAlign: "center",
            }}>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: "rgba(122,146,184,0.6)", margin: 0 }}>
                No active positions at this time. Check back after the next research run.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
              {active.map((pick) => (
                <PickCard key={pick.id ?? pick.ticker} pick={pick} />
              ))}
            </div>
          )}
        </section>

        {/* Recently exited */}
        {recently_exited.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(122,146,184,0.5)", marginBottom: 16 }}>
              Recently Exited
            </div>
            <div style={{
              background: "rgba(10,19,35,0.5)",
              border: "1px solid rgba(79,135,247,0.1)",
              borderRadius: 14,
              overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(79,135,247,0.1)", background: "rgba(79,135,247,0.04)" }}>
                    {["Ticker", "Company", "Added", "Exited", "Reason"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(61,82,120,0.9)", fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recently_exited.map((pick, i) => (
                    <tr key={pick.id ?? i} style={{ borderBottom: "1px solid rgba(79,135,247,0.06)" }}>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: "#e8edf8" }}>{pick.ticker}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(122,146,184,0.7)" }}>{pick.company_name}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(61,82,120,0.9)" }}>{formatDate(pick.entry_date)}</td>
                      <td style={{ padding: "10px 16px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(61,82,120,0.9)" }}>
                        {pick.exit_date ? formatDate(pick.exit_date) : "—"}
                      </td>
                      <td style={{ padding: "10px 16px", fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(122,146,184,0.55)", maxWidth: 280 }}>
                        {pick.exit_reason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(61,82,120,0.7)", lineHeight: 1.7, fontStyle: "italic" }}>
          Paper-trading exercise for educational purposes only. Nothing published here constitutes investment advice.
          Every number has a source URL. The full track record, wins and losses, is published without omission.
        </p>
      </main>
    </div>
  );
}
