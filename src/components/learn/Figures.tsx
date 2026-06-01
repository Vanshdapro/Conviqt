// Conviqt Learn — static lesson diagrams.
//
// Hand-built, reusable SVG figures keyed by FigureKey. There is no model-authored
// SVG anywhere in Learn anymore: a lesson references one of these by key and the
// trusted component renders it. Nothing here is dynamic or eval'd. Each figure
// draws on an 800x360 canvas and uses the track accent plus neutral greys.

import type { FigureKey } from "@/lib/learn/types";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#6b7f9e";
const LINE = "rgba(232,237,248,0.14)";
const FILL = "rgba(232,237,248,0.04)";
const GOOD = "#22c55e";
const BAD = "#ef4444";
const WARN = "#f59e0b";
const SANS = "var(--font-sans), system-ui, sans-serif";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";

type FC = (a: string) => React.ReactNode;

// ── Small primitives ─────────────────────────────────────────────────────────

function T(
  x: number,
  y: number,
  s: string,
  opts: { size?: number; fill?: string; anchor?: "start" | "middle" | "end"; weight?: number; mono?: boolean } = {},
) {
  const { size = 14, fill = MUTED, anchor = "start", weight = 500, mono = false } = opts;
  return (
    <text x={x} y={y} fontFamily={mono ? MONO : SANS} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight}>
      {s}
    </text>
  );
}

function Box(x: number, y: number, w: number, h: number, stroke: string, fill = FILL, r = 8) {
  return <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={stroke} strokeWidth={1.5} />;
}

function Arrow(x1: number, y1: number, x2: number, y2: number, color: string) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = 7;
  const ax = x2 - h * Math.cos(ang - Math.PI / 6);
  const ay = y2 - h * Math.sin(ang - Math.PI / 6);
  const bx = x2 - h * Math.cos(ang + Math.PI / 6);
  const by = y2 - h * Math.sin(ang + Math.PI / 6);
  return (
    <g stroke={color} fill={color}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={1.75} />
      <polygon points={`${x2},${y2} ${ax},${ay} ${bx},${by}`} stroke="none" />
    </g>
  );
}

// ── Figures ──────────────────────────────────────────────────────────────────

const threeStatements: FC = (a) => (
  <g>
    {Box(40, 120, 190, 120, a)}
    {T(135, 150, "Income statement", { anchor: "middle", fill: INK, weight: 650 })}
    {T(135, 178, "Revenue − costs", { anchor: "middle", size: 12.5 })}
    {T(135, 210, "= Net income", { anchor: "middle", size: 13, fill: a, mono: true })}

    {Box(305, 120, 190, 120, LINE)}
    {T(400, 150, "Balance sheet", { anchor: "middle", fill: INK, weight: 650 })}
    {T(400, 178, "Assets =", { anchor: "middle", size: 12.5 })}
    {T(400, 200, "Liabilities + Equity", { anchor: "middle", size: 12.5 })}
    {T(400, 224, "(a snapshot)", { anchor: "middle", size: 11.5, fill: FAINT })}

    {Box(570, 120, 190, 120, LINE)}
    {T(665, 150, "Cash flow", { anchor: "middle", fill: INK, weight: 650 })}
    {T(665, 178, "Where cash", { anchor: "middle", size: 12.5 })}
    {T(665, 200, "actually moved", { anchor: "middle", size: 12.5 })}

    {Arrow(230, 180, 305, 180, a)}
    {Arrow(495, 180, 570, 180, a)}
    {T(400, 285, "Net income flows to equity; cash flow reconciles profit to real cash.", { anchor: "middle", size: 12.5, fill: FAINT })}
    {T(400, 70, "The three statements are one linked system", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
  </g>
);

const incomeStatement: FC = (a) => {
  const rows = [
    ["Revenue", 600, INK],
    ["− Cost of goods sold", 360, MUTED],
    ["= Gross profit", 360, a],
    ["− Operating expenses", 220, MUTED],
    ["= Operating income", 220, a],
    ["− Interest & tax", 150, MUTED],
    ["= Net income", 150, GOOD],
  ] as const;
  return (
    <g>
      {T(40, 55, "From the top line to the bottom line", { size: 15, fill: INK, weight: 650 })}
      {rows.map((r, i) => {
        const y = 90 + i * 36;
        const isResult = (r[0] as string).startsWith("=");
        const isRev = i === 0;
        return (
          <g key={i}>
            {T(40, y + 4, r[0] as string, { size: 13.5, fill: r[2] as string, weight: isResult || isRev ? 650 : 500 })}
            <rect x={330} y={y - 12} width={(r[1] as number) * 0.7} height={18} rx={3} fill={isResult ? `${r[2]}22` : FILL} stroke={r[2] as string} strokeWidth={1.25} />
          </g>
        );
      })}
      {T(760, 90 + 6 * 36 + 4, "what owners keep", { anchor: "end", size: 11.5, fill: FAINT })}
    </g>
  );
};

const balanceSheet: FC = (a) => (
  <g>
    {T(400, 50, "Assets = Liabilities + Equity", { anchor: "middle", size: 16, fill: INK, weight: 650 })}
    {Box(60, 90, 300, 210, a)}
    {T(210, 120, "ASSETS", { anchor: "middle", size: 13, fill: a, weight: 650, mono: true })}
    {T(210, 150, "Cash, inventory,", { anchor: "middle", size: 12.5 })}
    {T(210, 170, "receivables, plant,", { anchor: "middle", size: 12.5 })}
    {T(210, 190, "goodwill", { anchor: "middle", size: 12.5 })}
    {T(210, 245, "What the company", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(210, 263, "owns and uses", { anchor: "middle", size: 11.5, fill: FAINT })}

    {T(390, 200, "=", { anchor: "middle", size: 26, fill: MUTED, weight: 650 })}

    {Box(440, 90, 300, 95, LINE)}
    {T(590, 122, "LIABILITIES", { anchor: "middle", size: 13, fill: MUTED, weight: 650, mono: true })}
    {T(590, 150, "Debt, payables, what is owed", { anchor: "middle", size: 12 })}
    {Box(440, 205, 300, 95, WARN)}
    {T(590, 237, "EQUITY", { anchor: "middle", size: 13, fill: WARN, weight: 650, mono: true })}
    {T(590, 265, "The owners' residual claim", { anchor: "middle", size: 12 })}
    {T(400, 335, "Two views of the same pile of money — it must balance.", { anchor: "middle", size: 12.5, fill: FAINT })}
  </g>
);

const cashFlow: FC = (a) => {
  const cols = [
    ["Operating", "+", GOOD, "Cash from the actual business"],
    ["Investing", "−", BAD, "Capex, acquisitions"],
    ["Financing", "±", WARN, "Debt, dividends, buybacks"],
  ] as const;
  return (
    <g>
      {T(400, 50, "Three buckets of cash movement", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {cols.map((c, i) => {
        const x = 60 + i * 240;
        return (
          <g key={i}>
            {Box(x, 90, 200, 140, i === 0 ? a : LINE)}
            {T(x + 100, 125, c[0] as string, { anchor: "middle", size: 14, fill: INK, weight: 650 })}
            {T(x + 100, 165, c[1] as string, { anchor: "middle", size: 30, fill: c[2] as string, weight: 700 })}
            {T(x + 100, 205, c[3] as string, { anchor: "middle", size: 11, fill: FAINT })}
          </g>
        );
      })}
      {T(400, 290, "Net change in cash", { anchor: "middle", size: 13, fill: MUTED })}
      <rect x={250} y={305} width={300} height={20} rx={4} fill={`${a}22`} stroke={a} strokeWidth={1.5} />
      {T(400, 319, "ties back to the balance sheet", { anchor: "middle", size: 11.5, fill: a, mono: true })}
    </g>
  );
};

const accruals: FC = () => {
  const ni = "M60,250 C200,230 340,150 760,90";
  const fcf = "M60,255 C200,260 360,250 760,250";
  return (
    <g>
      {T(40, 50, "When profit rises but cash doesn't", { size: 15, fill: INK, weight: 650 })}
      <path d={ni} fill="none" stroke={GOOD} strokeWidth={2.5} />
      <path d={fcf} fill="none" stroke={WARN} strokeWidth={2.5} strokeDasharray="2 5" />
      <path d={`${ni} L760,250 C360,250 200,260 60,255 Z`} fill={`${BAD}14`} stroke="none" />
      {T(700, 80, "Net income", { anchor: "end", size: 12.5, fill: GOOD, weight: 650 })}
      {T(700, 240, "Free cash flow", { anchor: "end", size: 12.5, fill: WARN, weight: 650 })}
      {T(430, 175, "widening gap", { anchor: "middle", size: 12, fill: BAD, weight: 650 })}
      {T(430, 193, "= earnings quality red flag", { anchor: "middle", size: 11, fill: FAINT })}
      <line x1={60} y1={280} x2={760} y2={280} stroke={LINE} strokeWidth={1.5} />
      {T(60, 300, "Time", { size: 11.5, fill: FAINT })}
    </g>
  );
};

const workingCapital: FC = (a) => {
  const cx = 400, cy = 195, r = 95;
  const pts = [
    [cx, cy - r, "Cash"],
    [cx + r, cy, "Inventory"],
    [cx, cy + r, "Receivables"],
    [cx - r, cy, "Payables"],
  ] as const;
  return (
    <g>
      {T(400, 50, "The cash conversion cycle", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={LINE} strokeWidth={1.5} strokeDasharray="3 4" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0] as number} cy={p[1] as number} r={6} fill={a} />
          {T(p[0] as number, (p[1] as number) + (i === 0 ? -16 : i === 2 ? 26 : 5), p[2] as string, { anchor: "middle", size: 12.5, fill: INK, weight: 600 })}
        </g>
      ))}
      {Arrow(cx + 24, cy - r + 8, cx + r - 8, cy - 24, a)}
      {Arrow(cx + r - 8, cy + 24, cx + 24, cy + r - 8, a)}
      {Arrow(cx - 24, cy + r - 8, cx - r + 8, cy + 24, a)}
      {Arrow(cx - r + 8, cy - 24, cx - 24, cy - r + 8, a)}
      {T(640, 170, "DIO + DSO − DPO", { anchor: "middle", size: 12.5, fill: a, mono: true, weight: 650 })}
      {T(640, 192, "= days cash is tied up", { anchor: "middle", size: 11.5, fill: FAINT })}
      {T(640, 214, "Shorter is better.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const dupont: FC = (a) => {
  const tiles = [
    ["Net margin", "Net income", "Revenue"],
    ["Asset turnover", "Revenue", "Assets"],
    ["Leverage", "Assets", "Equity"],
  ] as const;
  return (
    <g>
      {T(400, 50, "ROE = three levers, multiplied", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {tiles.map((t, i) => {
        const x = 55 + i * 215;
        return (
          <g key={i}>
            {Box(x, 110, 175, 110, i === 0 ? a : LINE)}
            {T(x + 87, 138, t[0] as string, { anchor: "middle", size: 13.5, fill: INK, weight: 650 })}
            {T(x + 87, 168, t[1] as string, { anchor: "middle", size: 12, fill: a })}
            <line x1={x + 35} y1={180} x2={x + 140} y2={180} stroke={MUTED} strokeWidth={1.25} />
            {T(x + 87, 200, t[2] as string, { anchor: "middle", size: 12, fill: MUTED })}
            {i < 2 && T(x + 200, 170, "×", { anchor: "middle", size: 22, fill: MUTED, weight: 700 })}
          </g>
        );
      })}
      {T(400, 270, "Profitability  ×  efficiency  ×  how much debt", { anchor: "middle", size: 12.5, fill: FAINT })}
      {T(400, 296, "Two firms with the same ROE can be completely different businesses.", { anchor: "middle", size: 12, fill: FAINT })}
    </g>
  );
};

const margins: FC = (a) => {
  const bars = [
    ["Revenue", 700, INK],
    ["Gross profit", 430, a],
    ["Operating income", 240, a],
    ["Net income", 140, GOOD],
  ] as const;
  return (
    <g>
      {T(40, 50, "Each margin strips out another layer of cost", { size: 15, fill: INK, weight: 650 })}
      {bars.map((b, i) => {
        const y = 95 + i * 52;
        return (
          <g key={i}>
            {T(40, y + 5, b[0] as string, { size: 13, fill: b[2] as string, weight: 600 })}
            <rect x={210} y={y - 14} width={b[1] as number * 0.78} height={26} rx={4} fill={`${b[2]}1f`} stroke={b[2] as string} strokeWidth={1.5} />
            {T(218 + (b[1] as number) * 0.78, y + 5, `${Math.round((b[1] as number) / 7)}%`, { size: 12, fill: b[2] as string, mono: true, weight: 650 })}
          </g>
        );
      })}
      {T(40, 322, "The gap between gross and net margin is where the business model lives.", { size: 12, fill: FAINT })}
    </g>
  );
};

const roicSpread: FC = (a) => (
  <g>
    {T(400, 50, "Value is created only above the cost of capital", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {T(230, 110, "ROIC", { anchor: "middle", size: 13, fill: GOOD, weight: 650 })}
    <rect x={150} y={125} width={160} height={150} rx={6} fill={`${GOOD}1f`} stroke={GOOD} strokeWidth={1.5} />
    {T(230, 205, "18%", { anchor: "middle", size: 26, fill: GOOD, weight: 700, mono: true })}
    {T(560, 110, "WACC", { anchor: "middle", size: 13, fill: MUTED, weight: 650 })}
    <rect x={480} y={200} width={160} height={75} rx={6} fill={FILL} stroke={MUTED} strokeWidth={1.5} />
    {T(560, 248, "9%", { anchor: "middle", size: 26, fill: MUTED, weight: 700, mono: true })}
    {Arrow(330, 165, 470, 165, a)}
    {T(400, 152, "the spread", { anchor: "middle", size: 12, fill: a, weight: 650 })}
    {T(400, 305, "A wide, durable ROIC − WACC spread is the engine of compounding.", { anchor: "middle", size: 12, fill: FAINT })}
    <line x1={150} y1={275} x2={640} y2={275} stroke={LINE} strokeWidth={1.5} />
  </g>
);

const dcfBridge: FC = (a) => {
  const yrs = [70, 62, 55, 48, 42];
  return (
    <g>
      {T(40, 50, "A company is worth its future cash, discounted to today", { size: 15, fill: INK, weight: 650 })}
      {yrs.map((h, i) => {
        const x = 70 + i * 70;
        return (
          <g key={i}>
            <rect x={x} y={260 - h} width={46} height={h} rx={3} fill={`${a}26`} stroke={a} strokeWidth={1.25} />
            {T(x + 23, 278, `Y${i + 1}`, { anchor: "middle", size: 11, fill: FAINT, mono: true })}
          </g>
        );
      })}
      {T(245, 300, "discounted yearly cash flows", { anchor: "middle", size: 11, fill: FAINT })}
      <rect x={470} y={110} width={90} height={150} rx={4} fill={`${WARN}1f`} stroke={WARN} strokeWidth={1.5} />
      {T(515, 295, "terminal value", { anchor: "middle", size: 11, fill: WARN, mono: true })}
      {T(515, 100, "the long tail", { anchor: "middle", size: 11, fill: FAINT })}
      {Arrow(575, 185, 625, 185, a)}
      {Box(625, 135, 130, 100, GOOD)}
      {T(690, 175, "Intrinsic", { anchor: "middle", size: 13, fill: GOOD, weight: 650 })}
      {T(690, 197, "value", { anchor: "middle", size: 13, fill: GOOD, weight: 650 })}
      <line x1={70} y1={260} x2={560} y2={260} stroke={LINE} strokeWidth={1.5} />
      {T(400, 335, "Most of the value usually sits in the terminal value — handle it with suspicion.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const multiples: FC = (a) => (
  <g>
    {T(400, 50, "A multiple is a shortcut for a full valuation", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(60, 95, 320, 180, a)}
    {T(220, 128, "P / E", { anchor: "middle", size: 16, fill: a, weight: 700, mono: true })}
    {T(220, 160, "Price per share", { anchor: "middle", size: 12.5 })}
    <line x1={150} y1={172} x2={290} y2={172} stroke={MUTED} strokeWidth={1.25} />
    {T(220, 192, "Earnings per share", { anchor: "middle", size: 12.5 })}
    {T(220, 235, "Ignores debt &", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(220, 253, "capital structure", { anchor: "middle", size: 11.5, fill: FAINT })}

    {Box(420, 95, 320, 180, LINE)}
    {T(580, 128, "EV / EBITDA", { anchor: "middle", size: 16, fill: INK, weight: 700, mono: true })}
    {T(580, 160, "Enterprise value", { anchor: "middle", size: 12.5 })}
    <line x1={500} y1={172} x2={660} y2={172} stroke={MUTED} strokeWidth={1.25} />
    {T(580, 192, "Operating cash earnings", { anchor: "middle", size: 12.5 })}
    {T(580, 235, "Capital-structure neutral —", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(580, 253, "compares across debt loads", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(400, 318, "Always ask what the multiple leaves out before you trust it.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const marginOfSafety: FC = (a) => (
  <g>
    {T(400, 50, "Buy well below your estimate of value", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <rect x={250} y={85} width={120} height={210} rx={6} fill={`${GOOD}14`} stroke={GOOD} strokeWidth={1.5} />
    {T(310, 78, "Intrinsic value", { anchor: "middle", size: 12, fill: GOOD, weight: 650 })}
    <rect x={250} y={205} width={120} height={90} rx={6} fill={`${a}26`} stroke={a} strokeWidth={1.5} />
    {T(310, 255, "Price", { anchor: "middle", size: 13, fill: a, weight: 650 })}
    <line x1={385} y1={205} x2={520} y2={205} stroke={GOOD} strokeWidth={1.25} strokeDasharray="4 4" />
    <line x1={385} y1={85} x2={520} y2={85} stroke={GOOD} strokeWidth={1.25} strokeDasharray="4 4" />
    {Arrow(500, 205, 500, 90, GOOD)}
    {Arrow(500, 90, 500, 205, GOOD)}
    {T(540, 150, "margin", { size: 12.5, fill: GOOD, weight: 650 })}
    {T(540, 168, "of safety", { size: 12.5, fill: GOOD, weight: 650 })}
    {T(540, 192, "room to be", { size: 11, fill: FAINT })}
    {T(540, 207, "wrong", { size: 11, fill: FAINT })}
    {T(400, 330, "The gap is your protection against bad luck and bad estimates.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const moat: FC = (a) => {
  const cx = 400, cy = 190;
  const sources = [
    [cx, 75, "Network effects"],
    [620, 150, "Switching costs"],
    [560, 295, "Cost advantage"],
    [240, 295, "Intangibles / brand"],
    [180, 150, "Efficient scale"],
  ] as const;
  return (
    <g>
      {T(400, 45, "Five things that actually protect high returns", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      <circle cx={cx} cy={cy} r={52} fill={`${a}1f`} stroke={a} strokeWidth={1.75} />
      {T(cx, cy - 4, "MOAT", { anchor: "middle", size: 14, fill: a, weight: 700, mono: true })}
      {T(cx, cy + 16, "durable edge", { anchor: "middle", size: 10.5, fill: FAINT })}
      {sources.map((s, i) => (
        <g key={i}>
          <line x1={cx} y1={cy} x2={s[0] as number} y2={s[1] as number} stroke={LINE} strokeWidth={1.5} />
          <circle cx={s[0] as number} cy={s[1] as number} r={5} fill={MUTED} />
          {T(s[0] as number, (s[1] as number) + ((s[1] as number) < cy ? -12 : 22), s[2] as string, { anchor: "middle", size: 12, fill: INK, weight: 550 })}
        </g>
      ))}
    </g>
  );
};

const pipeline: FC = (a) => {
  const stages = ["Macro gate", "Screener", "6 specialists", "CIO", "Portfolio"];
  return (
    <g>
      {T(400, 45, "How the Conviqt Council actually decides", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {stages.map((s, i) => {
        const x = 30 + i * 152;
        return (
          <g key={i}>
            {Box(x, 150, 128, 80, i === 2 ? a : LINE)}
            {T(x + 64, 185, s, { anchor: "middle", size: 12.5, fill: i === 2 ? a : INK, weight: 650 })}
            {i === 2 && T(x + 64, 207, "independent", { anchor: "middle", size: 10.5, fill: FAINT })}
            {i < stages.length - 1 && Arrow(x + 128, 190, x + 152, 190, MUTED)}
          </g>
        );
      })}
      {T(400, 280, "A structured committee with independent inputs beats one confident gut call.", { anchor: "middle", size: 12, fill: FAINT })}
    </g>
  );
};

const disagreement: FC = (a) => {
  const votes = [["BUY", GOOD], ["BUY", GOOD], ["HOLD", WARN], ["SELL", BAD], ["BUY", GOOD], ["SELL", BAD]] as const;
  return (
    <g>
      {T(400, 50, "When the lenses split, that's information", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {votes.map((v, i) => {
        const x = 90 + i * 105;
        return (
          <g key={i}>
            <rect x={x} y={100} width={84} height={48} rx={6} fill={`${v[1]}1f`} stroke={v[1] as string} strokeWidth={1.5} />
            {T(x + 42, 130, v[0] as string, { anchor: "middle", size: 13, fill: v[1] as string, weight: 700, mono: true })}
            {T(x + 42, 92, `Lens ${i + 1}`, { anchor: "middle", size: 10.5, fill: FAINT })}
          </g>
        );
      })}
      {T(180, 215, "Low disagreement", { size: 11.5, fill: FAINT })}
      {T(620, 215, "High disagreement", { anchor: "end", size: 11.5, fill: FAINT })}
      <rect x={150} y={225} width={500} height={10} rx={5} fill={FILL} stroke={LINE} strokeWidth={1} />
      <rect x={150} y={225} width={330} height={10} rx={5} fill={a} />
      <circle cx={480} cy={230} r={9} fill={INK} />
      {T(400, 280, "High conviction needs agreement. A fractured committee is real uncertainty.", { anchor: "middle", size: 12, fill: FAINT })}
    </g>
  );
};

const ratesGravity: FC = (a) => (
  <g>
    {T(40, 50, "Rates are gravity: higher discount rate, lower value", { size: 15, fill: INK, weight: 650 })}
    <path d="M70,110 C260,140 430,250 740,285" fill="none" stroke={a} strokeWidth={2.5} />
    <line x1={70} y1={285} x2={740} y2={285} stroke={LINE} strokeWidth={1.5} />
    <line x1={70} y1={90} x2={70} y2={285} stroke={LINE} strokeWidth={1.5} />
    {T(60, 110, "high", { anchor: "end", size: 11, fill: FAINT })}
    {T(45, 200, "Present", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(45, 216, "value", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(120, 305, "low rates", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(700, 305, "high rates", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(470, 150, "Long-duration growth", { size: 12, fill: INK, weight: 600 })}
    {T(470, 168, "stocks fall hardest", { size: 12, fill: a })}
  </g>
);

const creditCycle: FC = (a) => (
  <g>
    {T(400, 50, "Credit leads; equities follow", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <path d="M60,190 C180,90 260,90 380,190 C500,290 580,290 740,150" fill="none" stroke={a} strokeWidth={2.5} />
    <line x1={60} y1={190} x2={740} y2={190} stroke={LINE} strokeWidth={1.25} strokeDasharray="3 4" />
    {["Expansion", "Euphoria", "Contraction", "Repair"].map((p, i) => (
      <text key={i} x={110 + i * 190} y={250} fontFamily={SANS} fontSize={12} fill={FAINT} textAnchor="middle">{p}</text>
    ))}
    {T(400, 300, "Spreads widen before price breaks. Watch credit, not just the tape.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const barbell: FC = (a) => (
  <g>
    {T(400, 50, "Safe on one end, convex bets on the other — nothing fragile in between", { anchor: "middle", size: 14, fill: INK, weight: 650 })}
    <rect x={70} y={150} width={180} height={120} rx={8} fill={`${GOOD}14`} stroke={GOOD} strokeWidth={1.5} />
    {T(160, 200, "~85%", { anchor: "middle", size: 22, fill: GOOD, weight: 700, mono: true })}
    {T(160, 228, "maximally safe", { anchor: "middle", size: 12 })}
    <rect x={330} y={185} width={140} height={55} rx={8} fill="none" stroke={BAD} strokeWidth={1.5} strokeDasharray="4 5" />
    {T(400, 212, "the fragile", { anchor: "middle", size: 12, fill: BAD })}
    {T(400, 230, "middle: avoid", { anchor: "middle", size: 12, fill: BAD })}
    <rect x={550} y={150} width={180} height={120} rx={8} fill={`${a}1f`} stroke={a} strokeWidth={1.5} />
    {T(640, 200, "~15%", { anchor: "middle", size: 22, fill: a, weight: 700, mono: true })}
    {T(640, 228, "convex / capped loss", { anchor: "middle", size: 12 })}
    {T(400, 315, "Antifragile to tail events beats optimized for the average case.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const FIGURES: Record<string, FC> = {
  "three-statements": threeStatements,
  "income-statement": incomeStatement,
  "balance-sheet": balanceSheet,
  "cash-flow": cashFlow,
  accruals: accruals,
  "working-capital": workingCapital,
  dupont: dupont,
  margins: margins,
  "roic-spread": roicSpread,
  "dcf-bridge": dcfBridge,
  multiples: multiples,
  "margin-of-safety": marginOfSafety,
  moat: moat,
  pipeline: pipeline,
  disagreement: disagreement,
  "rates-gravity": ratesGravity,
  "credit-cycle": creditCycle,
  barbell: barbell,
};

export function LessonFigure({ figure, accent }: { figure: FigureKey; accent: string }) {
  const draw = FIGURES[figure];
  if (!draw) return null;
  return (
    <div
      style={{
        background: "#071120",
        border: "1px solid rgba(232,237,248,0.09)",
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      <svg viewBox="0 0 800 360" role="img" style={{ width: "100%", height: "auto", display: "block" }}>
        {draw(accent)}
      </svg>
    </div>
  );
}

/** Figure keys that have a real implementation — used to keep content honest. */
export const IMPLEMENTED_FIGURES = new Set<string>(Object.keys(FIGURES));
