"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";

// ── Data ──────────────────────────────────────────────────────────────────

const PIPELINE = [
  {
    step: "01",
    name: "Sweep",
    tags: ["web search", "live data", "#cited"],
    desc: "Hits the live web to gather the freshest data on the requested ticker. Builds a structured FactSheet where every single fact carries the exact URL it came from. No URL — no fact.",
    detail: ["Price", "Fundamentals", "News", "Macro"],
  },
  {
    step: "02",
    name: "Fundamentals",
    tags: ["valuation", "earnings", "#balance"],
    desc: "Reads the FactSheet and issues a verdict based on valuation multiples, earnings quality, and balance sheet strength. Every claim cites its source index.",
    detail: ["P/E", "EPS Growth", "FCF", "Margins"],
  },
  {
    step: "03",
    name: "Technicals",
    tags: ["price action", "momentum", "#chart"],
    desc: "Evaluates price action, trend structure, and momentum signals from the FactSheet. Confidence drops when technical data is sparse — and it says so explicitly.",
    detail: ["Trend", "RSI", "MACD", "Volume"],
  },
  {
    step: "04",
    name: "Sentiment",
    tags: ["news tone", "insider", "#flow"],
    desc: "Weighs news sentiment, insider transactions, and short interest. Flags divergence between sentiment and fundamentals — that divergence is often the signal.",
    detail: ["News Tone", "Insider Buys", "Short Interest", "Ratings"],
  },
  {
    step: "05",
    name: "Macro",
    tags: ["rates", "sector", "#fx"],
    desc: "Places the ticker in macroeconomic context. Rate environment, sector rotation, and currency exposure are all scored. Issues a headwind or tailwind call.",
    detail: ["Fed Policy", "Yield Curve", "Sector Flows", "FX"],
  },
  {
    step: "06",
    name: "Judge",
    tags: ["synthesis", "conviction", "#verdict"],
    desc: "Synthesizes all four specialist verdicts into a final BUY / HOLD / SELL. Produces a conviction score and a disagreement score. High disagreement is published — it is the signal, not a failure.",
    detail: ["Consensus", "Dissent", "Conviction", "Catalysts"],
    isJudge: true,
  },
];

const PRINCIPLES = [
  {
    label: "No synthetic data",
    body: "Every quantitative claim links to a public URL fetched from the live web. If a fact has no source URL, it is dropped. We never fall back to invented numbers.",
  },
  {
    label: "Disagreement is the product",
    body: "When specialists disagree, the Judge publishes the dissents alongside the verdict. A high disagreement score tells you the setup is contested — that is the most valuable signal we generate.",
  },
  {
    label: "Full track record, no omissions",
    body: "The Alpha Tracker publishes every trade — winners and losers — with the original thesis, source citations, and exit reason. The complete record, unedited, is the point.",
  },
];

// ── Sparkle decoration ─────────────────────────────────────────────────────

function Sparkle({ style }: { style?: React.CSSProperties }) {
  return (
    <motion.div
      animate={{ rotate: [0, 180, 360], scale: [1, 1.15, 1] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      style={{ position: "absolute", pointerEvents: "none", ...style }}
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
          d="M11 0L12.8 8.2L21 11L12.8 13.8L11 22L9.2 13.8L1 11L9.2 8.2L11 0Z"
          fill="rgba(79,135,247,0.5)"
        />
      </svg>
    </motion.div>
  );
}

// ── Faint candlestick background ───────────────────────────────────────────

function CandlestickBg() {
  const candles = [
    { x: 0, bodyY: 60, bodyH: 45, high: 20, low: 120, bull: false },
    { x: 22, bodyY: 40, bodyH: 55, high: 15, low: 115, bull: true },
    { x: 44, bodyY: 55, bodyH: 35, high: 30, low: 110, bull: false },
    { x: 66, bodyY: 30, bodyH: 65, high: 10, low: 120, bull: true },
    { x: 88, bodyY: 20, bodyH: 75, high: 5, low: 115, bull: true },
    { x: 110, bodyY: 45, bodyH: 50, high: 25, low: 110, bull: false },
    { x: 132, bodyY: 35, bodyH: 60, high: 12, low: 118, bull: true },
    { x: 154, bodyY: 55, bodyH: 40, high: 35, low: 108, bull: false },
    { x: 176, bodyY: 25, bodyH: 70, high: 8, low: 116, bull: true },
    { x: 198, bodyY: 50, bodyH: 45, high: 28, low: 112, bull: false },
  ];
  return (
    <svg
      width="220"
      height="140"
      viewBox="0 0 220 140"
      fill="none"
      style={{ position: "absolute", bottom: 40, left: 40, opacity: 0.07, pointerEvents: "none" }}
    >
      {candles.map((c, i) => (
        <g key={i}>
          <line x1={c.x + 7} y1={c.high} x2={c.x + 7} y2={c.bodyY} stroke={c.bull ? "#22c55e" : "#ef4444"} strokeWidth="1.5" />
          <rect x={c.x} y={c.bodyY} width="14" height={c.bodyH} fill={c.bull ? "#22c55e" : "#ef4444"} rx="1" />
          <line x1={c.x + 7} y1={c.bodyY + c.bodyH} x2={c.x + 7} y2={c.low} stroke={c.bull ? "#22c55e" : "#ef4444"} strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

// ── Pipeline node ──────────────────────────────────────────────────────────

function PipelineNode({
  item,
  index,
  activeIndex,
  onActivate,
}: {
  item: typeof PIPELINE[0];
  index: number;
  activeIndex: number;
  onActivate: (i: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isActive = activeIndex === index;
  const isCompleted = index < activeIndex;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onActivate(index);
      },
      { threshold: 0.5, rootMargin: "-20% 0px -20% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [index, onActivate]);

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        position: "relative",
        minHeight: 120,
        paddingBottom: 32,
      }}
    >
      {/* Node circle */}
      <div style={{ flexShrink: 0, width: 120, display: "flex", justifyContent: "center", paddingTop: 8 }}>
        <motion.div
          animate={{
            scale: isActive ? 1.15 : isCompleted ? 0.92 : 0.85,
            opacity: isActive ? 1 : isCompleted ? 0.6 : 0.35,
          }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {/* Glow ring for active */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                style={{
                  position: "absolute",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(79,135,247,0.35) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
            )}
          </AnimatePresence>

          {/* Circle */}
          <motion.div
            animate={{
              background: isActive
                ? "linear-gradient(135deg, #4f87f7 0%, #6fa0ff 100%)"
                : isCompleted
                ? "rgba(79,135,247,0.18)"
                : "rgba(79,135,247,0.07)",
              borderColor: isActive
                ? "#4f87f7"
                : isCompleted
                ? "rgba(79,135,247,0.4)"
                : "rgba(79,135,247,0.2)",
              boxShadow: isActive
                ? "0 0 20px rgba(79,135,247,0.6), 0 0 40px rgba(79,135,247,0.2)"
                : "none",
            }}
            transition={{ duration: 0.4 }}
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "2px solid",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              zIndex: 2,
            }}
          >
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              fontSize: 14,
              color: isActive ? "#fff" : isCompleted ? "rgba(122,146,184,0.8)" : "rgba(61,82,120,0.8)",
              letterSpacing: "0.05em",
            }}>
              {item.step}
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* Chevron connector */}
      <div style={{ display: "flex", alignItems: "center", paddingTop: 20, marginLeft: -4, marginRight: 4 }}>
        <motion.svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          animate={{ opacity: isActive ? 0.9 : 0.2 }}
          transition={{ duration: 0.4 }}
        >
          <path d="M10 3L5 8L10 13" stroke="#4f87f7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </div>

      {/* Card */}
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={isActive || isCompleted ? { x: 0, opacity: 1 } : { x: 40, opacity: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        style={{
          flex: 1,
          background: isActive ? "rgba(12,22,45,0.9)" : "rgba(10,19,35,0.6)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: `1px solid ${isActive ? "rgba(79,135,247,0.4)" : "rgba(79,135,247,0.1)"}`,
          borderLeft: `3px solid ${isActive ? "#4f87f7" : isCompleted ? "rgba(79,135,247,0.3)" : "rgba(79,135,247,0.1)"}`,
          borderRadius: 14,
          padding: "18px 22px 16px",
          transition: "border-color 0.4s, background 0.4s",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Top shimmer line on active */}
        {isActive && (
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 1,
              background: "linear-gradient(90deg, transparent, #4f87f7, rgba(111,160,255,0.5), transparent)",
              transformOrigin: "left",
            }}
          />
        )}

        {/* Header: name + tags */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 700,
            fontSize: 17,
            color: isActive ? "#e8edf8" : "rgba(232,237,248,0.7)",
            letterSpacing: "-0.4px",
            transition: "color 0.3s",
          }}>
            {item.name}
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {item.tags.map((tag) => (
              <span key={tag} style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: isActive ? "rgba(79,135,247,0.9)" : "rgba(61,82,120,0.8)",
                background: isActive ? "rgba(79,135,247,0.1)" : "rgba(79,135,247,0.04)",
                border: `1px solid ${isActive ? "rgba(79,135,247,0.3)" : "rgba(79,135,247,0.1)"}`,
                borderRadius: 6,
                padding: "2px 8px",
                letterSpacing: "0.05em",
                transition: "all 0.3s",
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Description */}
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          color: isActive ? "rgba(122,146,184,0.9)" : "rgba(122,146,184,0.55)",
          lineHeight: 1.65,
          margin: "0 0 12px",
          transition: "color 0.3s",
        }}>
          {item.desc}
        </p>

        {/* Detail tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {item.detail.map((d) => (
            <span key={d} style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              color: isActive ? "rgba(232,237,248,0.6)" : "rgba(61,82,120,0.7)",
              background: "rgba(79,135,247,0.06)",
              border: "1px solid rgba(79,135,247,0.08)",
              borderRadius: 8,
              padding: "3px 10px",
              transition: "all 0.3s",
            }}>
              {d}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ── Shared nav ─────────────────────────────────────────────────────────────

function DashNav() {
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
                fontWeight: key === "methodology" ? 600 : 400,
                fontSize: 13,
                color: key === "methodology" ? "#4f87f7" : "rgba(122,146,184,0.65)",
                padding: "6px 14px",
                borderRadius: 7,
                textDecoration: "none",
                borderBottom: key === "methodology" ? "2px solid #4f87f7" : "2px solid transparent",
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

// ── Animated vertical line ─────────────────────────────────────────────────

function PipelineVerticalLine({ totalNodes, activeIndex }: { totalNodes: number; activeIndex: number }) {
  const filledFraction = totalNodes > 1 ? activeIndex / (totalNodes - 1) : 0;
  const LINE_H = 120 * totalNodes - 32;

  return (
    <div style={{ position: "absolute", left: 59, top: 8, bottom: 0, width: 2, zIndex: 0 }}>
      {/* Background line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(79,135,247,0.1)", borderRadius: 1 }} />
      {/* Filled progress line */}
      <motion.div
        animate={{ height: `${filledFraction * 100}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          background: "linear-gradient(to bottom, #4f87f7, rgba(79,135,247,0.4))",
          borderRadius: 1,
          minHeight: 0,
        }}
      />
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function MethodologyPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleActivate = (i: number) => {
    setActiveIndex((prev) => Math.max(prev, i));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#050d1a", overflowX: "hidden" }}>
      <DashNav />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* Hero headline */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: 80, maxWidth: 760 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ height: 1, width: 32, background: "rgba(79,135,247,0.4)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "#4f87f7" }}>
              How it works
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(40px, 5.5vw, 64px)",
            letterSpacing: "clamp(-2.5px, -0.04em, -4px)",
            lineHeight: 1.05,
            color: "#e8edf8",
            margin: "0 0 20px",
          }}>
            One sweep. Four specialists.<br />
            <span style={{ color: "rgba(122,146,184,0.6)", fontWeight: 600 }}>One judge. Every dissent published.</span>
          </h1>
          <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: "rgba(122,146,184,0.75)", lineHeight: 1.7, margin: 0, maxWidth: 520 }}>
            When you analyze a stock, six AI agents run in sequence. Each only works with facts that have source URLs. The final verdict is a synthesis of four independent views — agreements and disagreements alike.
          </p>
        </motion.div>

        {/* ── Pipeline ── */}
        <section style={{ marginBottom: 100 }}>
          {/* THE PIPELINE label */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32, paddingLeft: 96 }}
          >
            <div style={{ height: 1, width: 24, background: "rgba(79,135,247,0.4)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase" as const, color: "rgba(79,135,247,0.7)" }}>
              The Pipeline
            </span>
          </motion.div>

          {/* Nodes + vertical line container */}
          <div style={{ position: "relative" }}>
            <CandlestickBg />
            <PipelineVerticalLine totalNodes={PIPELINE.length} activeIndex={activeIndex} />

            {/* Sparkle decorations */}
            <Sparkle style={{ top: 60, right: 20 }} />
            <Sparkle style={{ bottom: 120, right: 80, opacity: 0.5 }} />

            {/* Node list */}
            <div style={{ position: "relative", zIndex: 1 }}>
              {PIPELINE.map((item, i) => (
                <PipelineNode
                  key={item.step}
                  item={item}
                  index={i}
                  activeIndex={activeIndex}
                  onActivate={handleActivate}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Principles ── */}
        <section style={{ marginBottom: 80 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase" as const, color: "rgba(79,135,247,0.6)", marginBottom: 28 }}>
              Principles
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
              {PRINCIPLES.map((pr, i) => (
                <motion.div
                  key={pr.label}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  style={{
                    background: "rgba(10,19,35,0.5)",
                    border: "1px solid rgba(79,135,247,0.08)",
                    borderRadius: 12,
                    padding: "22px 26px",
                    display: "grid",
                    gridTemplateColumns: "minmax(160px, 200px) 1fr",
                    gap: 28,
                    alignItems: "start",
                  }}
                >
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: "#e8edf8", letterSpacing: "-0.3px" }}>
                    {pr.label}
                  </div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(122,146,184,0.8)", lineHeight: 1.7, margin: 0 }}>
                    {pr.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Specs grid ── */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}
          >
            {[
              { label: "Data Source", items: ["Live web search only", "No paid financial APIs", "Every fact cites its URL"] },
              { label: "Speed", items: ["Full council in ~30s", "Parallel specialist runs", "4h cache for repeats"] },
              { label: "Cadence", items: ["On-demand chat: 24/7", "Alpha picks: curated", "All exits published"] },
              { label: "Infrastructure", items: ["Next.js App Router", "Supabase + Vercel", "AI-native pipeline"] },
            ].map(({ label, items }) => (
              <div
                key={label}
                style={{
                  background: "rgba(10,19,35,0.5)",
                  border: "1px solid rgba(79,135,247,0.08)",
                  borderRadius: 12,
                  padding: "18px 20px",
                }}
              >
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "#4f87f7", marginBottom: 12 }}>
                  {label}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column" as const, gap: 7 }}>
                  {items.map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(122,146,184,0.7)" }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(79,135,247,0.4)", flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
