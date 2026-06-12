"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui";

// FirstRun — mounted once inside the logged-in shell (AppShell). Two acts:
//
//   1. Onboarding sheet (3 steps, skippable): investor style → experience
//      level → pick 3+ stocks. Saved via POST /api/profile; the tickers seed
//      the Watching list and personalize the Dashboard.
//   2. First-run tour (4 tooltips): Research → Skills → Dashboard → Portfolio,
//      addressing the user by name. Dismissible forever (tour_dismissed_at).
//
// Both states live on the user profile, so neither ever re-appears on another
// device once done. Copy rules: plain English, no machinery words.

type ProfileState = {
  name: string | null;
  investorStyle: string | null;
  experienceLevel: string | null;
  onboarded: boolean;
  tourDismissed: boolean;
  plan: string;
};

const STYLE_CARDS = [
  { id: "steady", title: "Slow & steady", sub: "Build wealth over years, not weeks. Low drama." },
  { id: "balanced", title: "A bit of both", sub: "Mostly steady, with room to explore ideas." },
  { id: "growth", title: "Growth hunter", sub: "Okay with swings if the upside is bigger." },
  { id: "bold", title: "Bold mover", sub: "High conviction, higher risk — eyes open." },
] as const;

const LEVEL_CARDS = [
  { id: "new", title: "Brand new", sub: "Just getting started — explain everything." },
  { id: "learning", title: "Learning the ropes", sub: "I know the basics and want to go deeper." },
  { id: "experienced", title: "Experienced", sub: "Skip the basics, give it to me straight." },
] as const;

// Household names a beginner recognizes — step 3 seeds Watching from these
// (plus anything they type). Max 10 (the Watching cap).
const STARTER_TICKERS = [
  "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL",
  "META", "NFLX", "AMD", "PLTR", "COIN", "HOOD",
  "DIS", "NKE", "SBUX", "MCD", "V", "JPM",
  "KO", "PEP", "UBER", "ABNB", "SHOP", "SOFI",
] as const;

const TICKER_RE = /^[A-Z]{1,5}(\.[A-Z])?$/;

// ── Onboarding sheet ─────────────────────────────────────────────────────────

export function OnboardingSheet({
  onClose,
}: {
  onClose: (completed: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleTicker = (t: string) =>
    setPicked((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : prev.length >= 10 ? prev : [...prev, t]
    );

  const addCustom = () => {
    const t = custom.toUpperCase().trim();
    if (TICKER_RE.test(t) && !picked.includes(t) && picked.length < 10) {
      setPicked((prev) => [...prev, t]);
    }
    setCustom("");
  };

  async function save(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Non-fatal — worst case the sheet shows once more next visit.
    } finally {
      setSaving(false);
    }
  }

  const skip = async () => {
    await save({ onboarded: true });
    onClose(false);
  };

  const finish = async () => {
    await save({
      onboarded: true,
      ...(style ? { investorStyle: style } : {}),
      ...(level ? { experienceLevel: level } : {}),
      ...(picked.length > 0 ? { watchTickers: picked } : {}),
    });
    onClose(true);
  };

  const titles = ["How do you like to invest?", "How much have you done this before?", "Pick a few stocks you care about"];
  const canNext = step === 0 ? !!style : step === 1 ? !!level : picked.length >= 3;

  return (
    <Sheet open onClose={skip} title={titles[step]}>
      <div className="cvq-ob">
        {step === 0 && (
          <>
            <p className="cvq-ob-lead">No wrong answers — this just helps tune what you see.</p>
            <div className="cvq-ob-cards">
              {STYLE_CARDS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cvq-ob-card"
                  aria-pressed={style === c.id}
                  onClick={() => setStyle(c.id)}
                >
                  <span className="cvq-ob-card-title">{c.title}</span>
                  <span className="cvq-ob-card-sub">{c.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="cvq-ob-lead">
              Answers adapt to you — we&apos;ll explain as much (or as little) as you want.
            </p>
            <div className="cvq-ob-cards cvq-ob-cards--rows">
              {LEVEL_CARDS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cvq-ob-card"
                  aria-pressed={level === c.id}
                  onClick={() => setLevel(c.id)}
                >
                  <span className="cvq-ob-card-title">{c.title}</span>
                  <span className="cvq-ob-card-sub">{c.sub}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="cvq-ob-lead">
              Pick at least 3. They&apos;ll appear in your Watching list and on your Dashboard.
            </p>
            <div className="cvq-ob-tickers" role="group" aria-label="Starter stocks">
              {STARTER_TICKERS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="cvq-ob-ticker"
                  aria-pressed={picked.includes(t)}
                  onClick={() => toggleTicker(t)}
                  data-no-translate
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="cvq-ob-custom">
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustom()}
                placeholder="Another ticker, e.g. RBLX"
                aria-label="Add another ticker"
                maxLength={7}
              />
              <button type="button" className="cvq-btn cvq-btn--secondary" onClick={addCustom}>
                Add
              </button>
            </div>
            <p className="cvq-ob-count" aria-live="polite">
              {picked.length < 3
                ? `${picked.length} of 3 picked`
                : `${picked.length} picked${picked.length >= 10 ? " — that's the limit" : ""}`}
            </p>
          </>
        )}

        <div className="cvq-ob-foot">
          <button type="button" className="cvq-ob-skip" onClick={skip} disabled={saving}>
            Skip for now
          </button>
          <div className="cvq-ob-dots" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="cvq-ob-dot" data-active={i === step} />
            ))}
          </div>
          <div className="cvq-ob-nav">
            {step > 0 && (
              <button type="button" className="cvq-btn cvq-btn--secondary" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < 2 ? (
              <button
                type="button"
                className="cvq-btn cvq-btn--primary"
                disabled={!canNext}
                onClick={() => setStep(step + 1)}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="cvq-btn cvq-btn--primary"
                disabled={!canNext || saving}
                onClick={finish}
              >
                {saving ? "Saving…" : "Finish"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

// ── First-run tour ───────────────────────────────────────────────────────────

type TourStep = {
  anchor: string;
  title: (firstName: string | null) => string;
  body: string;
};

const TOUR_STEPS: TourStep[] = [
  {
    anchor: "research",
    title: (n) => (n ? `Welcome, ${n} — this is Research` : "This is Research"),
    body: "Home base. Ask anything about any stock and get a plain-English answer — a deep report or a 30-second take.",
  },
  {
    anchor: "skills",
    title: () => "Skills are one-tap research",
    body: "Worth Owning?, Face-Off, Headline Decoder and more — ready-made questions, no typing needed.",
  },
  {
    anchor: "dashboard",
    title: () => "Your Dashboard",
    body: "A daily read on the market — plus our public track record. Every pick stays up, including the losses.",
  },
  {
    anchor: "portfolio",
    title: () => "Your Portfolio",
    body: "Add what you own or follow what you're watching, then run an AI Health Check whenever you like.",
  },
];

function visibleAnchor(key: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`);
  for (const n of nodes) {
    const r = n.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return n;
  }
  return null;
}

export function Tour({ name, onDone }: { name: string | null; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const firstName = name?.trim() ? name.trim().split(/\s+/)[0] : null;

  const measure = useCallback(() => {
    const el = visibleAnchor(TOUR_STEPS[step].anchor);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const dismiss = async () => {
    onDone();
    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourDismissed: true }),
      });
    } catch {
      /* shows again next visit at worst */
    }
  };

  const s = TOUR_STEPS[step];
  const last = step === TOUR_STEPS.length - 1;

  // Tooltip placement: next to the anchor (right of sidebar / above the tab
  // bar); centered when the anchor isn't on this page.
  const tipStyle: React.CSSProperties = {};
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (vw > 768) {
      tipStyle.left = Math.min(rect.right + 14, vw - 320);
      tipStyle.top = Math.max(12, Math.min(rect.top - 8, vh - 190));
    } else {
      tipStyle.left = 12;
      tipStyle.right = 12;
      if (rect.top > vh / 2) tipStyle.bottom = vh - rect.top + 12;
      else tipStyle.top = rect.bottom + 12;
    }
  } else {
    tipStyle.left = "50%";
    tipStyle.top = "40%";
    tipStyle.transform = "translate(-50%, -50%)";
  }

  return (
    <div className="cvq-tour-overlay" role="dialog" aria-modal="true" aria-label="Quick tour">
      {rect && (
        <span
          className="cvq-tour-spot"
          style={{ left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }}
          aria-hidden
        />
      )}
      <div className="cvq-tour-tip" style={tipStyle}>
        <p className="cvq-tour-tip-title">{s.title(firstName)}</p>
        <p className="cvq-tour-tip-body">{s.body}</p>
        <div className="cvq-tour-tip-foot">
          <button type="button" className="cvq-ob-skip" onClick={dismiss}>
            Skip tour
          </button>
          <span className="cvq-tour-count" aria-hidden>
            {step + 1}/{TOUR_STEPS.length}
          </span>
          <button
            type="button"
            className="cvq-btn cvq-btn--primary"
            onClick={() => (last ? dismiss() : setStep(step + 1))}
          >
            {last ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Orchestration ────────────────────────────────────────────────────────────

export function FirstRun() {
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    let alive = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p: ProfileState | null) => {
        if (!alive || !p) return;
        setProfile(p);
        if (!p.onboarded) setShowOnboarding(true);
        else if (!p.tourDismissed) setShowTour(true);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  if (showOnboarding) {
    return (
      <OnboardingSheet
        onClose={() => {
          setShowOnboarding(false);
          if (profile && !profile.tourDismissed) setShowTour(true);
        }}
      />
    );
  }

  if (showTour) {
    return <Tour name={profile?.name ?? null} onDone={() => setShowTour(false)} />;
  }

  return null;
}
