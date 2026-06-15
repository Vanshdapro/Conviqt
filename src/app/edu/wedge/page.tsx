"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FUNDAMENTALS, getFundamentals, FUNDAMENTALS_AS_OF, FUNDAMENTALS_SOURCE } from "@/lib/edu/data/fundamentals";
import { getAsset, PRICES_AS_OF, type PricePoint } from "@/lib/edu/data/prices";
import {
  computeDcf,
  defaultAssumptions,
  fairValuePath,
  classifyWedge,
  type DcfAssumptions,
} from "@/lib/edu/dcf";

export default function WedgePage() {
  const [ticker, setTicker] = useState("AAPL");
  const fundamentals = getFundamentals(ticker)!;
  const asset = getAsset(ticker);

  const baseAssumptions = useMemo(() => defaultAssumptions(fundamentals), [fundamentals]);
  const [assumptions, setAssumptions] = useState<DcfAssumptions>(baseAssumptions);

  // Reset assumptions when the asset changes.
  const lastTicker = useRef(ticker);
  if (lastTicker.current !== ticker) {
    lastTicker.current = ticker;
    setAssumptions(baseAssumptions);
  }

  const dcf = useMemo(() => computeDcf(fundamentals, assumptions), [fundamentals, assumptions]);
  const fair = useMemo(
    () => (dcf.valid && asset ? fairValuePath(dcf.intrinsicPerShare, asset.points, assumptions.terminalGrowth) : []),
    [dcf, asset, assumptions.terminalGrowth]
  );
  const wedge = useMemo(
    () => (dcf.valid && asset ? classifyWedge(ticker, fundamentals.name, asset.points, fair) : null),
    [dcf, asset, fair, ticker, fundamentals.name]
  );

  const setNum = (key: keyof DcfAssumptions) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAssumptions((a) => ({ ...a, [key]: Number(e.target.value) }));

  return (
    <div className="sbx">
      <header className="sbx-head">
        <h1>Market Wedge Finder</h1>
        <p>
          Fundamental value (a discounted-cash-flow line) against the actual
          market price. The shaded gap is the wedge — the distortion to explain.
        </p>
      </header>

      <div className="sbx-grid">
        <section className="sbx-controls" aria-label="Valuation controls">
          <label className="sbx-field">
            <span className="sbx-field-label">Company</span>
            <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
              {FUNDAMENTALS.map((f) => (
                <option key={f.ticker} value={f.ticker}>
                  {f.ticker} — {f.name}
                </option>
              ))}
            </select>
            <span className="sbx-note">{asset?.note ?? "equity"}</span>
          </label>

          {dcf.valid ? (
            <>
              <label className="sbx-field">
                <span className="sbx-field-label">
                  Discount Rate
                  <strong>{(assumptions.discountRate * 100).toFixed(2)}%</strong>
                </span>
                <input
                  type="range"
                  min={0.05}
                  max={0.15}
                  step={0.0025}
                  value={assumptions.discountRate}
                  onChange={setNum("discountRate")}
                />
                <span className="sbx-note">cost of capital · default = policy rate + 5.5%</span>
              </label>

              <label className="sbx-field">
                <span className="sbx-field-label">
                  Near-term Growth
                  <strong>{(assumptions.nearGrowth * 100).toFixed(1)}%</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={0.15}
                  step={0.005}
                  value={assumptions.nearGrowth}
                  onChange={setNum("nearGrowth")}
                />
                <span className="sbx-note">FCF growth for {assumptions.nearYears}y · terminal fixed 2.5%</span>
              </label>

              <button
                type="button"
                className="sbx-reset"
                onClick={() => setAssumptions(baseAssumptions)}
                disabled={
                  assumptions.discountRate === baseAssumptions.discountRate &&
                  assumptions.nearGrowth === baseAssumptions.nearGrowth
                }
              >
                Reset assumptions
              </button>

              <div className="wdg-readout">
                <span className="sbx-note">Fundamental value / share</span>
                <strong>${dcf.intrinsicPerShare.toFixed(0)}</strong>
                <span className="sbx-note">
                  vs market ${asset?.points[asset.points.length - 1].close.toFixed(0)}
                </span>
              </div>
            </>
          ) : (
            <p className="sbx-invalid">{dcf.reason}</p>
          )}
        </section>

        <section className="sbx-output">
          {dcf.valid && asset ? (
            <>
              <WedgeChart price={asset.points} fair={fair} />
              <div className="sbx-legend">
                <span>
                  <i className="sbx-swatch sbx-swatch-actual" /> Market price
                </span>
                <span>
                  <i className="sbx-swatch sbx-swatch-cf" /> Fundamental value
                </span>
                <span>
                  <i className="wdg-swatch-wedge" /> The wedge
                </span>
              </div>

              {wedge && (
                <div className="wdg-verdict">
                  <span className="wdg-label">{wedge.label}</span>
                  <span className="wdg-pct">
                    market {wedge.latestPct >= 0 ? "+" : ""}
                    {wedge.latestPct}% vs fundamental
                  </span>
                  <ul className="sbx-bullets">
                    {wedge.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="sbx-method">
                <strong>How this is computed:</strong> two-stage discounted cash
                flow on {fundamentals.name}&apos;s free cash flow (operating cash
                flow − capex), normalized over the last 3 fiscal years, grown at
                the near-term rate for {assumptions.nearYears} years then a 2.5%
                terminal rate, discounted at your rate. The fundamental line
                projects that intrinsic value across history at the terminal
                rate. The wedge is assumption-sensitive — move the sliders and it
                moves. Fundamentals: {FUNDAMENTALS_SOURCE}, snapshot{" "}
                {FUNDAMENTALS_AS_OF} (XBRL extraction may differ from polished
                vendor data). Prices: snapshot {PRICES_AS_OF}. Not investment
                advice.
              </p>
            </>
          ) : (
            <div className="edu-stub">
              <span className="edu-kicker">DCF not applicable</span>
              <h1 style={{ fontSize: 22 }}>{fundamentals.name}</h1>
              <p className="sbx-invalid" style={{ marginTop: 12 }}>{dcf.reason}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Canvas chart with shaded wedge ────────────────────────────────────────
function WedgeChart({ price, fair }: { price: PricePoint[]; fair: PricePoint[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;

    const cssW = wrap.clientWidth;
    const cssH = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const css = getComputedStyle(document.documentElement);
    const col = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;
    const inkPrice = col("--text-2", "#63372C");
    const inkFair = col("--accent", "#0E7978");
    const grid = col("--border", "#DED2B8");
    const axis = col("--text-muted", "#7A6A5A");

    const padL = 52;
    const padR = 12;
    const padT = 14;
    const padB = 26;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const all = [...price, ...fair];
    if (all.length === 0) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of all) {
      if (p.close < lo) lo = p.close;
      if (p.close > hi) hi = p.close;
    }
    const padV = (hi - lo) * 0.08 || 1;
    lo = Math.max(0, lo - padV);
    hi = hi + padV;

    const n = Math.max(price.length, fair.length);
    const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
    const y = (v: number) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

    // Grid + y labels.
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = axis;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let t = 0; t <= 4; t++) {
      const v = lo + ((hi - lo) * t) / 4;
      const yy = y(v);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(cssW - padR, yy);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(`$${v.toFixed(0)}`, 8, yy + 3);
    }
    if (price.length > 1) {
      ctx.fillText(price[0].date, padL, cssH - 8);
      const last = price[price.length - 1].date;
      ctx.fillText(last, cssW - padR - ctx.measureText(last).width, cssH - 8);
    }

    // Shade the wedge: forward along price, back along fair.
    const m = Math.min(price.length, fair.length);
    if (m > 1) {
      ctx.beginPath();
      ctx.moveTo(x(0), y(price[0].close));
      for (let i = 1; i < m; i++) ctx.lineTo(x(i), y(price[i].close));
      for (let i = m - 1; i >= 0; i--) ctx.lineTo(x(i), y(fair[i].close));
      ctx.closePath();
      ctx.fillStyle = inkFair;
      ctx.globalAlpha = 0.13;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const drawLine = (series: PricePoint[], color: string, width: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      series.forEach((p, i) => {
        const px = x(i);
        const py = y(p.close);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    drawLine(fair, inkFair, 2.25);
    drawLine(price, inkPrice, 1.75);
  }, [price, fair]);

  return (
    <div className="sbx-chart">
      <canvas ref={ref} />
    </div>
  );
}
