"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

// ── Particle Canvas ────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
}

function ParticleCanvas({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Non-null aliases for use in nested closures (TypeScript narrowing limitation)
    const cvs = canvas as HTMLCanvasElement;
    const cx = ctx as CanvasRenderingContext2D;

    let animId: number;
    let particles: Particle[] = [];
    const COUNT = Math.floor(70 * intensity);
    const CONNECT_DIST = 130;

    const resize = () => {
      cvs.width = cvs.offsetWidth * window.devicePixelRatio;
      cvs.height = cvs.offsetHeight * window.devicePixelRatio;
      cx.scale(window.devicePixelRatio, window.devicePixelRatio);
      initParticles();
    };

    function initParticles() {
      const w = cvs.offsetWidth;
      const h = cvs.offsetHeight;
      particles = Array.from({ length: COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.8 + 0.6,
        opacity: Math.random() * 0.5 + 0.2,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.012 + 0.006,
      }));
    }

    function draw() {
      const w = cvs.offsetWidth;
      const h = cvs.offsetHeight;
      cx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        const pulsedOpacity = p.opacity * (0.7 + 0.3 * Math.sin(p.pulse));
        cx.beginPath();
        cx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        cx.fillStyle = `rgba(79, 135, 247, ${pulsedOpacity})`;
        cx.fill();
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.18;
            cx.beginPath();
            cx.moveTo(a.x, a.y);
            cx.lineTo(b.x, b.y);
            cx.strokeStyle = `rgba(79, 135, 247, ${alpha})`;
            cx.lineWidth = 0.8;
            cx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px clamp(24px, 6vw, 96px)",
        background: scrolled ? "rgba(5,13,26,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(79,135,247,0.1)" : "none",
        transition: "background 0.3s, border-color 0.3s",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
        <Image src="/logo1.png" alt="Conviqt" width={32} height={32} style={{ objectFit: "contain" }} />
        <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 17, letterSpacing: "-0.6px", color: "#e8edf8" }}>
          Conviqt
        </span>
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {[
          { label: "Research", href: "/chat" },
          { label: "Alpha Tracker", href: "/alpha" },
          { label: "Methodology", href: "/methodology" },
        ].map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 500,
              fontSize: 14,
              color: "rgba(232,237,248,0.6)",
              padding: "7px 12px",
              borderRadius: 7,
              textDecoration: "none",
              transition: "color 0.15s",
            }}
          >
            {label}
          </Link>
        ))}
        <Link
          href="/chat"
          style={{
            marginLeft: 6,
            background: "#4f87f7",
            border: "none",
            borderRadius: 8,
            padding: "8px 20px",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: "#050d1a",
            textDecoration: "none",
            letterSpacing: "-0.2px",
          }}
        >
          Launch App
        </Link>
      </div>
    </nav>
  );
}

// ── SearchBox ─────────────────────────────────────────────────────────────

function HeroSearchBox() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const submit = () => {
    const q = query.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <div
      style={{
        maxWidth: 680,
        width: "100%",
        borderRadius: 16,
        background: "rgba(6,12,24,0.8)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(79,135,247,0.2)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,135,247,0.05) inset",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "rgba(122,146,184,0.6)" }}>
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
        <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Ask about NVDA, AAPL, or any market thesis…"
        className="hero-search-input"
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "'Inter', sans-serif",
          fontSize: 15,
          fontWeight: 400,
          color: "#e8edf8",
          caretColor: "#4f87f7",
        }}
      />
      <button
        onClick={submit}
        style={{
          background: "#4f87f7",
          border: "none",
          borderRadius: 10,
          padding: "8px 18px",
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          color: "#050d1a",
          cursor: "pointer",
          flexShrink: 0,
          letterSpacing: "-0.2px",
        }}
      >
        Research
      </button>
    </div>
  );
}

// ── Fade-in helper ─────────────────────────────────────────────────────────

function FadeIn({ children, delay = 0, y = 24, className = "" }: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

// ── Section: Hero ──────────────────────────────────────────────────────────

function HeroMain() {
  const { scrollY } = useScroll();
  const logoY = useTransform(scrollY, [0, 400], [0, -60]);
  const logoOpacity = useTransform(scrollY, [0, 300], [1, 0]);
  const textY = useTransform(scrollY, [0, 400], [0, -30]);

  return (
    <section style={{ position: "relative", width: "100%", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      {/* Deep navy gradient background */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 30%, #0d1f3f 0%, #050d1a 60%)" }} />

      {/* Subtle grid overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage: "linear-gradient(rgba(79,135,247,1) 1px, transparent 1px), linear-gradient(90deg, rgba(79,135,247,1) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 70% 50% at 50% 40%, black 0%, transparent 100%)",
      }} />

      <ParticleCanvas />

      {/* Vignette bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "35vh", background: "linear-gradient(to top, #050d1a 0%, transparent 100%)", pointerEvents: "none", zIndex: 2 }} />

      <Navbar />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "0 clamp(24px, 6vw, 96px)", paddingTop: 120, maxWidth: 900, margin: "0 auto", width: "100%" }}>

        {/* Logo */}
        <motion.div style={{ y: logoY, opacity: logoOpacity, marginBottom: 36 }}>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src="/logo.png"
              alt="Conviqt"
              width={120}
              height={120}
              style={{ objectFit: "contain", filter: "drop-shadow(0 0 32px rgba(79,135,247,0.4))" }}
              priority
            />
          </motion.div>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(79,135,247,0.08)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(79,135,247,0.25)", borderRadius: 999,
            padding: "5px 16px 5px 8px",
          }}>
            <span style={{ background: "#4f87f7", color: "#050d1a", borderRadius: 4, padding: "2px 8px", fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              AI Research
            </span>
            <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: "rgba(79,135,247,0.9)", letterSpacing: "-0.1px" }}>
              Citation-first equity intelligence
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          style={{ y: textY }}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span style={{
            display: "block",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(48px, 7.5vw, 84px)",
            letterSpacing: "clamp(-3px, -0.04em, -5px)",
            lineHeight: 1,
            color: "#e8edf8",
            marginBottom: 4,
          }}>
            Intelligence.
          </span>
          <span style={{
            display: "block",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(48px, 7.5vw, 84px)",
            letterSpacing: "clamp(-3px, -0.04em, -5px)",
            lineHeight: 1,
            background: "linear-gradient(135deg, #4f87f7 0%, #a0c4ff 60%, #e8edf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            marginBottom: 4,
          }}>
            Cited.
          </span>
          <span style={{
            display: "block",
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(48px, 7.5vw, 84px)",
            letterSpacing: "clamp(-3px, -0.04em, -5px)",
            lineHeight: 1,
            color: "rgba(232,237,248,0.5)",
          }}>
            Accountable.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 400,
            fontSize: 18,
            letterSpacing: "-0.3px",
            color: "rgba(122,146,184,0.9)",
            maxWidth: 520,
            margin: "28px auto 36px",
            lineHeight: 1.65,
          }}
        >
          Five AI agents debate every stock against live web data.
          Every number has a source URL. Every trade is public.
        </motion.p>

        {/* Search box */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%" }}
        >
          <HeroSearchBox />
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          style={{ display: "flex", alignItems: "center", gap: 32, marginTop: 40 }}
        >
          {[
            { num: "5", label: "AI Agents" },
            { num: "100%", label: "Cited" },
            { num: "0", label: "Hidden trades" },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 22, color: "#4f87f7", letterSpacing: "-1px" }}>{num}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 12, color: "rgba(122,146,184,0.7)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.6 }}
        style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(122,146,184,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Scroll
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 5.5L8 10.5L13 5.5" stroke="rgba(79,135,247,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ── Section: The Council ───────────────────────────────────────────────────

const AGENTS = [
  { id: "01", name: "Sweep", desc: "Live web data collection with source validation", icon: "⬡" },
  { id: "02", name: "Fundamentals", desc: "Valuation, earnings quality, balance sheet strength", icon: "◈" },
  { id: "03", name: "Technicals", desc: "Price action, momentum, chart structure", icon: "◇" },
  { id: "04", name: "Sentiment", desc: "News tone, insider activity, short interest", icon: "◉" },
  { id: "05", name: "Macro", desc: "Rate environment, sector rotation, FX exposure", icon: "◎" },
  { id: "06", name: "Judge", desc: "Synthesizes all agents into a final verdict + conviction score", icon: "◆" },
];

function CouncilSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} style={{ position: "relative", padding: "120px clamp(24px, 6vw, 96px)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(26,50,96,0.3) 0%, transparent 70%)" }} />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
        {/* Section label */}
        <FadeIn>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ height: 1, width: 40, background: "rgba(79,135,247,0.4)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4f87f7" }}>
              The Council
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "clamp(36px, 5vw, 60px)", letterSpacing: "-2px", lineHeight: 1.05, color: "#e8edf8", marginBottom: 16 }}>
            Five specialists.<br />One signal.
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 17, color: "rgba(122,146,184,0.85)", maxWidth: 500, lineHeight: 1.65, marginBottom: 64 }}>
            Every query runs a multi-agent pipeline. Specialists debate in parallel.
            The Judge synthesizes — then publishes both the verdict <em>and</em> the dissents.
          </p>
        </FadeIn>

        {/* Agent cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {AGENTS.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              style={{
                background: "rgba(10,19,35,0.7)",
                backdropFilter: "blur(16px)",
                border: `1px solid ${agent.id === "06" ? "rgba(79,135,247,0.35)" : "rgba(79,135,247,0.1)"}`,
                borderRadius: 14,
                padding: "20px 22px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {agent.id === "06" && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #4f87f7, transparent)" }} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(79,135,247,0.5)", letterSpacing: "0.1em" }}>{agent.id}</span>
                <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14, color: "#e8edf8", letterSpacing: "-0.3px" }}>{agent.name}</span>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 13, color: "rgba(122,146,184,0.8)", lineHeight: 1.55, margin: 0 }}>
                {agent.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Connecting arrows visualization */}
        <FadeIn delay={0.8}>
          <div style={{ marginTop: 48, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, transparent, rgba(79,135,247,0.3), transparent)" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(79,135,247,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              disagrement score exposed to reader
            </span>
            <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, transparent, rgba(79,135,247,0.3), transparent)" }} />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Section: Transparency ──────────────────────────────────────────────────

function TransparencySection() {
  return (
    <section style={{ padding: "120px clamp(24px, 6vw, 96px)", background: "rgba(6,12,24,0.5)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
        {/* Left */}
        <div>
          <FadeIn>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <div style={{ height: 1, width: 40, background: "rgba(79,135,247,0.4)" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4f87f7" }}>
                Alpha Tracker
              </span>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 4vw, 52px)", letterSpacing: "-2px", lineHeight: 1.05, color: "#e8edf8", marginBottom: 20 }}>
              Every trade.<br />No omissions.
            </h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 16, color: "rgba(122,146,184,0.85)", lineHeight: 1.7, marginBottom: 32 }}>
              The Alpha Tracker is a live paper-trading record. Active positions show real-time price changes. Every exit — including losses — is published with the original thesis and source citations intact.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <Link href="/alpha" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 14,
              color: "#4f87f7", textDecoration: "none", letterSpacing: "-0.2px",
              borderBottom: "1px solid rgba(79,135,247,0.3)", paddingBottom: 2,
            }}>
              View active positions
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7H11.5M11.5 7L7.5 3M11.5 7L7.5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </FadeIn>
        </div>

        {/* Right — sample pick card */}
        <FadeIn delay={0.3} y={40}>
          <div style={{
            background: "rgba(10,19,35,0.8)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(79,135,247,0.15)",
            borderLeft: "3px solid #4f87f7",
            borderRadius: 14,
            overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(79,135,247,0.1)", background: "rgba(79,135,247,0.04)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 26, color: "#e8edf8", letterSpacing: "-1px" }}>NVDA</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(122,146,184,0.7)", marginTop: 2 }}>Nvidia Corporation</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 18, color: "#22c55e", fontWeight: 600 }}>+12.4%</div>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "rgba(122,146,184,0.5)", marginTop: 2 }}>vs entry</div>
              </div>
            </div>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(79,135,247,0.08)" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(79,135,247,0.6)", textTransform: "uppercase", marginBottom: 6 }}>Catalyst</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(232,237,248,0.85)", lineHeight: 1.5 }}>Blackwell ramp + data-center demand inflection ahead of earnings</div>
            </div>
            <div style={{ padding: "10px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              <div style={{ borderRight: "1px solid rgba(79,135,247,0.08)", paddingRight: 12 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "rgba(122,146,184,0.5)", textTransform: "uppercase", marginBottom: 4 }}>Target</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "#22c55e", fontWeight: 600 }}>$175.00</div>
              </div>
              <div style={{ paddingLeft: 12 }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "rgba(122,146,184,0.5)", textTransform: "uppercase", marginBottom: 4 }}>Stop</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, color: "rgba(122,146,184,0.7)", fontWeight: 500 }}>$138.00</div>
              </div>
            </div>
            <div style={{ padding: "10px 20px 14px", borderTop: "1px solid rgba(79,135,247,0.08)" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < 8 ? "#4f87f7" : "rgba(79,135,247,0.15)" }} />
                ))}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "rgba(122,146,184,0.5)", marginTop: 5 }}>8/10 conviction</div>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Section: CTA ───────────────────────────────────────────────────────────

function CTASection() {
  return (
    <section style={{ position: "relative", padding: "140px clamp(24px, 6vw, 96px)", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 60% at 50% 50%, #0d1f3f 0%, #050d1a 70%)" }} />
      <ParticleCanvas intensity={0.6} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 40% 40% at 50% 50%, rgba(79,135,247,0.06) 0%, transparent 70%)" }} />

      <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 10 }}>
        <FadeIn>
          <div style={{
            display: "inline-block",
            background: "rgba(79,135,247,0.08)",
            border: "1px solid rgba(79,135,247,0.2)",
            borderRadius: 999,
            padding: "5px 18px",
            marginBottom: 28,
          }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#4f87f7", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Ready to research?
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h2 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: "clamp(40px, 6vw, 72px)", letterSpacing: "-3px", lineHeight: 1, color: "#e8edf8", marginBottom: 20 }}>
            Start with any stock.
          </h2>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, fontSize: 17, color: "rgba(122,146,184,0.8)", lineHeight: 1.65, marginBottom: 48, maxWidth: 500, margin: "0 auto 48px" }}>
            Ask a question. Get five AI perspectives with every source cited.
            No black boxes. No spin.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Link
              href="/chat"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#4f87f7",
                border: "none",
                borderRadius: 14,
                padding: "16px 40px",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 700,
                fontSize: 17,
                color: "#050d1a",
                textDecoration: "none",
                letterSpacing: "-0.4px",
                boxShadow: "0 0 40px rgba(79,135,247,0.35), 0 0 80px rgba(79,135,247,0.12)",
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 50px rgba(79,135,247,0.5), 0 0 100px rgba(79,135,247,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(79,135,247,0.35), 0 0 80px rgba(79,135,247,0.12)";
              }}
            >
              View Our Dashboard
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9H15M15 9L9.5 3.5M15 9L9.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "rgba(122,146,184,0.45)", letterSpacing: "-0.1px" }}>
              Educational research only · Paper trading · No financial advice
            </span>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid rgba(79,135,247,0.1)", padding: "28px clamp(24px, 6vw, 96px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Image src="/logo1.png" alt="Conviqt" width={20} height={20} style={{ objectFit: "contain" }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, color: "rgba(232,237,248,0.7)", letterSpacing: "-0.3px" }}>Conviqt</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {[{ label: "Research", href: "/chat" }, { label: "Alpha Tracker", href: "/alpha" }, { label: "Methodology", href: "/methodology" }].map(({ label, href }) => (
            <Link key={label} href={href} style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: "rgba(122,146,184,0.55)", textDecoration: "none", letterSpacing: "-0.1px" }}>{label}</Link>
          ))}
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "rgba(61,82,120,0.8)" }}>Educational use only · Not investment advice</span>
      </div>
    </footer>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function HeroSection() {
  return (
    <div style={{ background: "#050d1a", minHeight: "100vh" }}>
      <HeroMain />
      <CouncilSection />
      <TransparencySection />
      <CTASection />
      <Footer />
    </div>
  );
}
