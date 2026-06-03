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

// ── Expansion figures: missing keys + new lessons ────────────────────────────

const secondOrder: FC = (a) => (
  <g>
    {T(400, 45, "First-level stops at the obvious. The paid step is the next one.", { anchor: "middle", size: 14, fill: INK, weight: 650 })}
    {Box(60, 95, 300, 70, LINE)}
    {T(210, 124, "“Good news — buy it”", { anchor: "middle", size: 13, fill: INK, weight: 600 })}
    {T(210, 146, "first-order", { anchor: "middle", size: 11, fill: FAINT, mono: true })}
    {Arrow(210, 165, 210, 205, MUTED)}
    {Box(60, 205, 300, 80, a)}
    {T(210, 232, "“Is it already priced in?", { anchor: "middle", size: 12.5, fill: a, weight: 600 })}
    {T(210, 252, "and then what?”", { anchor: "middle", size: 12.5, fill: a, weight: 600 })}
    {T(210, 273, "second-order", { anchor: "middle", size: 11, fill: FAINT, mono: true })}
    {Arrow(370, 240, 440, 200, MUTED)}
    {Box(450, 120, 290, 160, GOOD)}
    {T(595, 150, "The non-obvious edge", { anchor: "middle", size: 13, fill: GOOD, weight: 650 })}
    {T(595, 182, "Who is selling to me,", { anchor: "middle", size: 12, fill: MUTED })}
    {T(595, 202, "and what do they know?", { anchor: "middle", size: 12, fill: MUTED })}
    {T(595, 234, "Markets fall on good news", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(595, 252, "the crowd already bought.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const baseRate: FC = (a) => (
  <g>
    {T(400, 50, "Anchor on what usually happens, then adjust", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {T(190, 100, "Outside view", { anchor: "middle", size: 12.5, fill: a, weight: 650 })}
    <rect x={70} y={120} width={240} height={120} rx={8} fill={`${a}14`} stroke={a} strokeWidth={1.5} />
    {T(190, 155, "Reference class", { anchor: "middle", size: 12.5, fill: INK, weight: 600 })}
    {T(190, 182, "“Of 100 firms like this,", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(190, 200, "how many sustained it?”", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(190, 226, "the boring statistic", { anchor: "middle", size: 11, fill: FAINT, mono: true })}
    {T(610, 100, "Inside view", { anchor: "middle", size: 12.5, fill: WARN, weight: 650 })}
    <rect x={490} y={120} width={240} height={120} rx={8} fill={FILL} stroke={WARN} strokeWidth={1.5} strokeDasharray="4 5" />
    {T(610, 155, "This time is different", { anchor: "middle", size: 12.5, fill: INK, weight: 600 })}
    {T(610, 182, "The vivid bottom-up", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(610, 200, "story crowds it out", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Arrow(310, 180, 490, 180, MUTED)}
    {T(400, 300, "Start from the base rate. Demand a strong reason to override it.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const reflexivity: FC = (a) => (
  <g>
    {T(400, 50, "Prices and fundamentals feed back on each other", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(120, 110, 220, 80, a)}
    {T(230, 142, "Rising price", { anchor: "middle", size: 13.5, fill: a, weight: 650 })}
    {T(230, 166, "cheaper capital, optimism", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Box(460, 200, 220, 80, GOOD)}
    {T(570, 232, "Better fundamentals", { anchor: "middle", size: 13.5, fill: GOOD, weight: 650 })}
    {T(570, 256, "growth, M&A, hiring", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Arrow(340, 165, 470, 205, a)}
    {Arrow(460, 250, 300, 190, GOOD)}
    {T(400, 305, "Self-reinforcing on the way up, self-defeating on the way down — booms and busts.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const sentiment: FC = (a) => (
  <g>
    {T(400, 45, "Tops on euphoria, bottoms on capitulation", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <path d="M60,250 C150,90 240,80 300,150 C360,220 440,250 520,180 C600,110 690,250 740,250" fill="none" stroke={a} strokeWidth={2.5} />
    <circle cx={230} cy={92} r={6} fill={BAD} />
    {T(230, 78, "Euphoria — sell", { anchor: "middle", size: 11.5, fill: BAD, weight: 650 })}
    <circle cx={470} cy={232} r={6} fill={GOOD} />
    {T(470, 256, "Capitulation — buy", { anchor: "middle", size: 11.5, fill: GOOD, weight: 650 })}
    {T(400, 300, "Measure positioning (put/call, surveys, cash) — don't trust the vibe. Wait for the extreme + a catalyst.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const compounding: FC = (a) => {
  const bars = [20, 26, 35, 47, 64, 88, 122, 170];
  return (
    <g>
      {T(40, 50, "Compounding is slow, then sudden", { size: 15, fill: INK, weight: 650 })}
      {bars.map((h, i) => {
        const x = 70 + i * 82;
        return (
          <g key={i}>
            <rect x={x} y={275 - h} width={54} height={h} rx={3} fill={`${a}${i > 4 ? "33" : "1f"}`} stroke={a} strokeWidth={1.25} />
            {T(x + 27, 292, `Y${(i + 1) * 5}`, { anchor: "middle", size: 10.5, fill: FAINT, mono: true })}
          </g>
        );
      })}
      <line x1={60} y1={275} x2={760} y2={275} stroke={LINE} strokeWidth={1.5} />
      {T(560, 120, "Most of the wealth", { size: 12, fill: INK, weight: 600 })}
      {T(560, 138, "arrives in the final years", { size: 12, fill: a })}
    </g>
  );
};

const drawdown: FC = () => {
  const rows = [["−20%", "+25%", 25], ["−50%", "+100%", 100], ["−80%", "+400%", 100]] as const;
  return (
    <g>
      {T(40, 50, "The deeper the hole, the steeper the climb", { size: 15, fill: INK, weight: 650 })}
      {rows.map((r, i) => {
        const y = 110 + i * 60;
        return (
          <g key={i}>
            {T(40, y + 5, `Lose ${r[0]}`, { size: 13, fill: BAD, weight: 600 })}
            {T(190, y + 5, "needs", { size: 11.5, fill: FAINT })}
            <rect x={250} y={y - 12} width={(r[2] as number) / 100 * 420} height={20} rx={4} fill={`${BAD}1f`} stroke={BAD} strokeWidth={1.25} />
            {T(258 + (r[2] as number) / 100 * 420, y + 4, r[1] as string, { size: 12.5, fill: BAD, weight: 650, mono: true })}
          </g>
        );
      })}
      {T(40, 300, "Losses and recoveries are not symmetric. Avoid the deep hole in the first place.", { size: 12, fill: FAINT })}
    </g>
  );
};

const correlation: FC = (a) => (
  <g>
    {T(400, 45, "Count is not diversification — correlation is", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {T(200, 90, "30 correlated names", { anchor: "middle", size: 12, fill: BAD, weight: 600 })}
    {Array.from({ length: 12 }).map((_, i) => (
      <rect key={i} x={90 + (i % 6) * 38} y={110 + Math.floor(i / 6) * 38} width={30} height={30} rx={5} fill={`${BAD}26`} stroke={BAD} strokeWidth={1} />
    ))}
    {T(200, 215, "= one bet, 30 times", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(600, 90, "Low-correlation mix", { anchor: "middle", size: 12, fill: GOOD, weight: 600 })}
    {[GOOD, a, WARN, "#38bdf8", "#a78bfa", "#f472b6"].map((c, i) => (
      <rect key={i} x={490 + (i % 3) * 70} y={110 + Math.floor(i / 3) * 50} width={56} height={40} rx={6} fill={`${c}26`} stroke={c} strokeWidth={1.25} />
    ))}
    {T(600, 215, "= genuine diversification", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(400, 295, "In a crisis correlations converge toward 1 — build for the bad day.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const kelly: FC = (a) => (
  <g>
    {T(400, 50, "Bet size vs long-run growth", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <path d="M70,260 C200,150 330,120 430,120 C520,120 640,200 740,290" fill="none" stroke={a} strokeWidth={2.5} />
    <line x1={70} y1={260} x2={740} y2={260} stroke={LINE} strokeWidth={1.5} />
    <line x1={430} y1={120} x2={430} y2={285} stroke={GOOD} strokeWidth={1.25} strokeDasharray="4 4" />
    {T(430, 110, "full Kelly", { anchor: "middle", size: 11.5, fill: GOOD, weight: 650 })}
    <line x1={250} y1={150} x2={250} y2={285} stroke={MUTED} strokeWidth={1.25} strokeDasharray="4 4" />
    {T(250, 175, "half Kelly", { anchor: "middle", size: 11, fill: INK })}
    {T(620, 215, "over-betting:", { size: 11.5, fill: BAD, weight: 600 })}
    {T(620, 233, "growth falls, ruin rises", { size: 11, fill: FAINT })}
    {T(120, 300, "too timid", { anchor: "middle", size: 11, fill: FAINT })}
    {T(700, 305, "ruin", { anchor: "middle", size: 11, fill: BAD })}
  </g>
);

const expectedValue: FC = () => (
  <g>
    {T(40, 50, "A losing hit-rate can still be a winning bet", { size: 15, fill: INK, weight: 650 })}
    <rect x={60} y={110} width={300} height={50} rx={6} fill={`${GOOD}1f`} stroke={GOOD} strokeWidth={1.5} />
    {T(75, 140, "Win 40%  ×  +120%", { size: 13, fill: GOOD, weight: 600 })}
    {T(345, 140, "= +48", { anchor: "end", size: 13, fill: GOOD, weight: 650, mono: true })}
    <rect x={60} y={175} width={180} height={50} rx={6} fill={`${BAD}1f`} stroke={BAD} strokeWidth={1.5} />
    {T(75, 205, "Lose 60%  ×  −25%", { size: 13, fill: BAD, weight: 600 })}
    {T(225, 205, "= −15", { anchor: "end", size: 13, fill: BAD, weight: 650, mono: true })}
    {Arrow(400, 167, 470, 167, MUTED)}
    {Box(480, 130, 260, 80, GOOD)}
    {T(610, 162, "Expected value", { anchor: "middle", size: 13, fill: INK, weight: 600 })}
    {T(610, 190, "+33% per bet", { anchor: "middle", size: 17, fill: GOOD, weight: 700, mono: true })}
    {T(40, 290, "Asymmetry — not your hit rate — is the edge. Optimize EV, not how often you're right.", { size: 12, fill: FAINT })}
  </g>
);

const reverseDcf: FC = (a) => (
  <g>
    {T(400, 50, "Don't forecast — invert", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(70, 110, 250, 110, LINE)}
    {T(195, 142, "Normal DCF", { anchor: "middle", size: 13, fill: MUTED, weight: 650 })}
    {T(195, 170, "assume growth", { anchor: "middle", size: 12 })}
    {T(195, 192, "→ derive value", { anchor: "middle", size: 12, fill: FAINT })}
    {Arrow(330, 165, 400, 165, MUTED)}
    {Box(410, 110, 320, 110, a)}
    {T(570, 142, "Reverse DCF", { anchor: "middle", size: 13, fill: a, weight: 650 })}
    {T(570, 170, "take today's price", { anchor: "middle", size: 12 })}
    {T(570, 192, "→ solve for the growth it requires", { anchor: "middle", size: 12, fill: FAINT })}
    {T(400, 270, "Now ask: is that embedded growth plausible — or heroic?", { anchor: "middle", size: 12.5, fill: INK, weight: 600 })}
    {T(400, 296, "Your edge lives in the gap between what's priced in and what's likely.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const segment: FC = (a) => {
  const segs = [["Cloud", 55, a], ["Devices", 25, MUTED], ["Other", 20, WARN]] as const;
  let acc = 0;
  return (
    <g>
      {T(400, 50, "One company, very different businesses inside", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {T(60, 110, "Revenue mix", { size: 12, fill: FAINT, mono: true })}
      <g>
        {segs.map((s, i) => {
          const w = (s[1] as number) / 100 * 680;
          const x = 60 + acc;
          acc += w;
          return (
            <g key={i}>
              <rect x={x} y={125} width={w - 4} height={40} rx={5} fill={`${s[2]}26`} stroke={s[2] as string} strokeWidth={1.5} />
              {T(x + w / 2, 150, `${s[0]} ${s[1]}%`, { anchor: "middle", size: 12, fill: s[2] as string, weight: 650 })}
            </g>
          );
        })}
      </g>
      {T(60, 205, "Operating margin", { size: 12, fill: FAINT, mono: true })}
      {segs.map((s, i) => {
        const x = 60 + i * 230;
        const m = [42, 8, -5][i];
        return (
          <g key={i}>
            {T(x + 100, 235, s[0] as string, { anchor: "middle", size: 12, fill: INK })}
            {T(x + 100, 262, `${m > 0 ? "+" : ""}${m}%`, { anchor: "middle", size: 18, fill: m > 20 ? GOOD : m > 0 ? WARN : BAD, weight: 700, mono: true })}
          </g>
        );
      })}
      {T(400, 300, "The blended number hides a great business subsidizing a weak one. Read the segments.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const goodwill: FC = (a) => (
  <g>
    {T(400, 50, "Goodwill is the premium paid over what you bought", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <rect x={120} y={100} width={180} height={180} rx={8} fill={FILL} stroke={LINE} strokeWidth={1.5} />
    {T(210, 90, "Price paid", { anchor: "middle", size: 12, fill: MUTED })}
    <rect x={120} y={200} width={180} height={80} rx={8} fill={`${a}1f`} stroke={a} strokeWidth={1.5} />
    {T(210, 245, "Net assets", { anchor: "middle", size: 12.5, fill: a, weight: 600 })}
    <rect x={120} y={100} width={180} height={100} rx={8} fill={`${WARN}1f`} stroke={WARN} strokeWidth={1.5} />
    {T(210, 145, "Goodwill", { anchor: "middle", size: 13, fill: WARN, weight: 650 })}
    {T(210, 165, "(the premium)", { anchor: "middle", size: 10.5, fill: FAINT })}
    {Arrow(330, 190, 420, 190, MUTED)}
    <rect x={440} y={140} width={300} height={100} rx={8} fill={`${BAD}14`} stroke={BAD} strokeWidth={1.5} strokeDasharray="4 5" />
    {T(590, 175, "Impairment", { anchor: "middle", size: 13, fill: BAD, weight: 650 })}
    {T(590, 205, "if the deal disappoints, goodwill", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(590, 223, "gets written down later", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(400, 315, "A balance sheet heavy with goodwill is a record of prices paid — watch for write-downs.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const leases: FC = (a) => (
  <g>
    {T(400, 50, "Leases are debt by another name", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(90, 110, 280, 150, LINE)}
    {T(230, 140, "Old view", { anchor: "middle", size: 12.5, fill: MUTED, weight: 650 })}
    {T(230, 172, "“We just rent it”", { anchor: "middle", size: 12.5 })}
    {T(230, 200, "off the balance sheet,", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(230, 218, "leverage looked low", { anchor: "middle", size: 11.5, fill: FAINT })}
    {Arrow(370, 185, 430, 185, MUTED)}
    {Box(430, 110, 280, 150, a)}
    {T(570, 140, "Post-ASC 842", { anchor: "middle", size: 12.5, fill: a, weight: 650 })}
    {T(570, 172, "Right-of-use asset", { anchor: "middle", size: 12.5, fill: INK })}
    {T(570, 196, "= Lease liability", { anchor: "middle", size: 12.5, fill: INK })}
    {T(570, 222, "the obligation is now visible", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(400, 300, "A committed future payment is leverage — capitalize it before judging the balance sheet.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const stockComp: FC = (a) => (
  <g>
    {T(400, 50, "Stock comp is a real cost — paid in your ownership", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {[0, 1, 2, 3].map((i) => {
      const x = 90 + i * 165;
      const slice = 100 - i * 9;
      return (
        <g key={i}>
          <rect x={x} y={120} width={120} height={120} rx={8} fill={FILL} stroke={LINE} strokeWidth={1.25} />
          <rect x={x} y={120 + (120 - slice * 1.05)} width={120} height={slice * 1.05} rx={8} fill={`${a}26`} stroke={a} strokeWidth={1.25} />
          {T(x + 60, 195, `${slice}%`, { anchor: "middle", size: 15, fill: a, weight: 700, mono: true })}
          {T(x + 60, 258, `Year ${i * 3}`, { anchor: "middle", size: 11, fill: FAINT, mono: true })}
        </g>
      );
    })}
    {T(400, 300, "“Adjusted” earnings add SBC back. Don't — your slice of the company is genuinely shrinking.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const unitEconomics: FC = (a) => (
  <g>
    {T(400, 50, "Does one customer earn back what they cost?", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {T(60, 110, "Cost to acquire (CAC)", { size: 12, fill: BAD, weight: 600 })}
    <rect x={60} y={122} width={130} height={34} rx={5} fill={`${BAD}1f`} stroke={BAD} strokeWidth={1.5} />
    {T(125, 144, "$300", { anchor: "middle", size: 13, fill: BAD, weight: 650, mono: true })}
    {T(60, 195, "Lifetime value (LTV)", { size: 12, fill: a, weight: 600 })}
    <rect x={60} y={207} width={560} height={34} rx={5} fill={`${a}1f`} stroke={a} strokeWidth={1.5} />
    {T(340, 229, "$1,050  =  margin × months retained", { anchor: "middle", size: 13, fill: a, weight: 650, mono: true })}
    {T(680, 145, "LTV/CAC", { anchor: "middle", size: 12, fill: GOOD, weight: 650 })}
    {T(680, 172, "3.5×", { anchor: "middle", size: 22, fill: GOOD, weight: 700, mono: true })}
    {T(400, 295, "Healthy: LTV/CAC ≥ 3 and payback under a year. Below 1, growth just burns cash.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const capitalAllocation: FC = (a) => {
  const opts = ["Reinvest", "Acquire", "Pay debt", "Dividends", "Buy back"];
  return (
    <g>
      {T(400, 45, "The CEO's real job: where does each dollar go?", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      <circle cx={400} cy={110} r={30} fill={`${a}1f`} stroke={a} strokeWidth={1.75} />
      {T(400, 108, "$1 of", { anchor: "middle", size: 10.5, fill: a, mono: true })}
      {T(400, 122, "FCF", { anchor: "middle", size: 11, fill: a, weight: 650, mono: true })}
      {opts.map((o, i) => {
        const x = 70 + i * 145;
        return (
          <g key={i}>
            {Arrow(400, 140, x + 60, 195, LINE)}
            {Box(x, 200, 120, 60, i === 0 ? GOOD : LINE)}
            {T(x + 60, 235, o, { anchor: "middle", size: 12, fill: i === 0 ? GOOD : INK, weight: 600 })}
          </g>
        );
      })}
      {T(400, 305, "Judge management by the returns earned on these choices — it compounds for decades.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const forensic: FC = () => {
  const flags = [
    ["Earnings up, cash flow flat", BAD],
    ["Receivables growing > sales", BAD],
    ["Margins defying the industry", WARN],
    ["Frequent “one-time” charges", WARN],
    ["Acquisitions blur organic trend", WARN],
  ] as const;
  return (
    <g>
      {T(40, 48, "Where the bodies are usually buried", { size: 15, fill: INK, weight: 650 })}
      {flags.map((f, i) => {
        const y = 90 + i * 42;
        return (
          <g key={i}>
            <rect x={50} y={y - 16} width={14} height={14} rx={3} fill={`${f[1]}33`} stroke={f[1] as string} strokeWidth={1.25} />
            {T(78, y - 4, f[0] as string, { size: 13, fill: INK })}
          </g>
        );
      })}
      {T(40, 310, "F-Score rewards improving quality; M- and Z-Scores flag manipulation and distress.", { size: 11.5, fill: FAINT })}
    </g>
  );
};

const operatingLeverageFig: FC = (a) => (
  <g>
    {T(400, 50, "High fixed costs amplify every revenue swing", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <line x1={80} y1={280} x2={740} y2={280} stroke={LINE} strokeWidth={1.5} />
    <line x1={80} y1={90} x2={80} y2={280} stroke={LINE} strokeWidth={1.5} />
    <line x1={80} y1={170} x2={740} y2={170} stroke={WARN} strokeWidth={2} strokeDasharray="5 5" />
    {T(736, 162, "fixed costs", { anchor: "end", size: 11, fill: WARN })}
    <path d="M80,250 L740,110" stroke={a} strokeWidth={2.5} fill="none" />
    {T(430, 175, "breakeven", { anchor: "middle", size: 11, fill: FAINT })}
    <circle cx={430} cy={170} r={5} fill={INK} />
    {T(640, 120, "profit zone", { size: 11.5, fill: GOOD })}
    {T(150, 250, "loss zone", { size: 11.5, fill: BAD })}
    {T(400, 305, "Past breakeven, extra sales are nearly all profit; below it, the fixed base bleeds.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const sotp: FC = (a) => {
  const parts = [["Core ops", 60, a], ["Hidden segment", 25, GOOD], ["Net cash / stakes", 15, WARN]] as const;
  let acc = 0;
  return (
    <g>
      {T(400, 50, "Value the pieces, then add them up", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {parts.map((p, i) => {
        const h = (p[1] as number) / 100 * 150;
        const x = 110 + i * 150;
        return (
          <g key={i}>
            <rect x={x} y={250 - h} width={110} height={h} rx={6} fill={`${p[2]}26`} stroke={p[2] as string} strokeWidth={1.5} />
            {T(x + 55, 268, p[0] as string, { anchor: "middle", size: 11, fill: INK })}
            {T(x + 55, 250 - h - 8, `${p[1]}`, { anchor: "middle", size: 12, fill: p[2] as string, weight: 650, mono: true })}
          </g>
        );
      })}
      {T(560, 150, "+", { size: 26, fill: MUTED, weight: 700 })}
      {Box(600, 150, 150, 90, GOOD)}
      {T(675, 185, "Sum of parts", { anchor: "middle", size: 12, fill: GOOD, weight: 600 })}
      {T(675, 212, "> the whole?", { anchor: "middle", size: 12, fill: GOOD, weight: 650 })}
      {T(400, 305, "A conglomerate can be worth more split up than the market prices it together.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const normalizedEarnings: FC = (a) => (
  <g>
    {T(40, 50, "Smooth the cycle before you judge the multiple", { size: 15, fill: INK, weight: 650 })}
    <path d="M70,210 C170,120 250,290 350,160 C450,90 540,250 640,150 C690,120 720,170 740,180" fill="none" stroke={MUTED} strokeWidth={2} />
    <line x1={70} y1={185} x2={740} y2={185} stroke={a} strokeWidth={2.5} strokeDasharray="6 5" />
    {T(736, 177, "normalized / 10-yr avg", { anchor: "end", size: 11, fill: a, weight: 600 })}
    {T(250, 115, "peak earnings:", { size: 11.5, fill: BAD })}
    {T(250, 132, "multiple looks cheap", { size: 11, fill: FAINT })}
    {T(360, 300, "trough earnings:", { size: 11.5, fill: GOOD })}
    {T(360, 282, "multiple looks dear", { size: 11, fill: FAINT })}
    {T(40, 325, "CAPE / normalized P/E use average earnings so the cycle can't fool the valuation.", { size: 11.5, fill: FAINT })}
  </g>
);

const dividendDiscount: FC = (a) => (
  <g>
    {T(400, 50, "A share is the present value of its future dividends", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {[0, 1, 2, 3, 4].map((i) => {
      const x = 90 + i * 110;
      const h = 90 - i * 14;
      return (
        <g key={i}>
          <rect x={x} y={240 - h} width={70} height={h} rx={4} fill={`${a}26`} stroke={a} strokeWidth={1.25} />
          {T(x + 35, 258, `D${i + 1}`, { anchor: "middle", size: 11, fill: FAINT, mono: true })}
        </g>
      );
    })}
    {Arrow(640, 195, 700, 195, MUTED)}
    {Box(660, 150, 90, 90, GOOD)}
    {T(705, 195, "Value", { anchor: "middle", size: 12, fill: GOOD, weight: 650 })}
    {T(400, 300, "Value = D ÷ (r − g). It only works for stable, dividend-paying businesses — know its limits.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const inversion: FC = (a) => (
  <g>
    {T(400, 50, "“Invert, always invert” — solve the problem backwards", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(80, 110, 280, 130, LINE)}
    {T(220, 142, "Forward", { anchor: "middle", size: 12.5, fill: MUTED, weight: 650 })}
    {T(220, 172, "“How do I succeed?”", { anchor: "middle", size: 12.5 })}
    {T(220, 200, "vague, infinite answers", { anchor: "middle", size: 11, fill: FAINT })}
    {Arrow(360, 175, 430, 175, MUTED)}
    {Box(430, 110, 300, 130, a)}
    {T(580, 142, "Inverted", { anchor: "middle", size: 12.5, fill: a, weight: 650 })}
    {T(580, 172, "“How would I guarantee failure?”", { anchor: "middle", size: 12, fill: INK })}
    {T(580, 200, "then avoid every one of those", { anchor: "middle", size: 11, fill: FAINT })}
    {T(400, 300, "Avoiding stupidity is easier — and more reliable — than seeking brilliance.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const incentives: FC = (a) => (
  <g>
    {T(400, 50, "“Show me the incentive and I'll show you the outcome”", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(120, 120, 200, 90, a)}
    {T(220, 152, "How are they paid?", { anchor: "middle", size: 12.5, fill: a, weight: 600 })}
    {T(220, 180, "bonus, options, fees", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Arrow(320, 165, 480, 165, MUTED)}
    {Box(480, 120, 200, 90, GOOD)}
    {T(580, 152, "Predicts behavior", { anchor: "middle", size: 12.5, fill: GOOD, weight: 600 })}
    {T(580, 180, "better than stated intent", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(400, 270, "Before trusting a forecast or a rating, ask who profits if you believe it.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const bayes: FC = (a) => (
  <g>
    {T(400, 50, "Update in steps — don't lurch to certainty", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {["Prior", "+ Evidence", "Posterior", "+ Evidence", "Updated"].map((s, i) => {
      const x = 40 + i * 152;
      const isStep = i % 2 === 0;
      return (
        <g key={i}>
          {isStep ? Box(x, 150, 120, 70, i === 4 ? GOOD : a) : null}
          {isStep
            ? T(x + 60, 190, s, { anchor: "middle", size: 12.5, fill: i === 4 ? GOOD : a, weight: 650 })
            : T(x + 60, 190, s, { anchor: "middle", size: 11, fill: FAINT })}
          {!isStep && Arrow(x + 5, 185, x + 115, 185, MUTED)}
        </g>
      );
    })}
    {T(400, 285, "New facts move your estimate proportionally — strong priors need strong evidence to shift.", { anchor: "middle", size: 12, fill: FAINT })}
  </g>
);

const anchoring: FC = (a) => (
  <g>
    {T(400, 50, "The first number sticks — even when it's irrelevant", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <line x1={80} y1={200} x2={740} y2={200} stroke={LINE} strokeWidth={1.5} />
    <circle cx={250} cy={200} r={9} fill={BAD} />
    {T(250, 180, "anchor: 52-week high", { anchor: "middle", size: 11.5, fill: BAD })}
    <circle cx={560} cy={200} r={9} fill={a} />
    {T(560, 180, "actual value", { anchor: "middle", size: 11.5, fill: a })}
    <path d="M250,215 C320,260 480,260 555,213" fill="none" stroke={MUTED} strokeWidth={1.5} strokeDasharray="4 4" />
    {T(405, 258, "your estimate gets dragged toward the anchor", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(400, 305, "Past prices, IPO levels, your cost basis — all irrelevant anchors. Value from scratch.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const disposition: FC = (a) => (
  <g>
    {T(400, 50, "The disposition effect: sell winners, marry losers", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(90, 110, 280, 130, GOOD)}
    {T(230, 140, "Winner", { anchor: "middle", size: 13, fill: GOOD, weight: 650 })}
    {T(230, 170, "“Lock in the gain!”", { anchor: "middle", size: 12.5 })}
    {T(230, 198, "sold too early →", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(230, 216, "caps the upside", { anchor: "middle", size: 11.5, fill: FAINT })}
    {Box(430, 110, 280, 130, BAD)}
    {T(570, 140, "Loser", { anchor: "middle", size: 13, fill: BAD, weight: 650 })}
    {T(570, 170, "“It'll come back…”", { anchor: "middle", size: 12.5 })}
    {T(570, 198, "held too long →", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(570, 216, "lets the loss grow", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(400, 300, "Exactly backwards. Tax and momentum both argue for cutting losers and running winners.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const herding: FC = (a) => (
  <g>
    {T(400, 45, "Comfort in the crowd — until the exit", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Array.from({ length: 14 }).map((_, i) => {
      const lone = i === 13;
      return (
        <g key={i}>
          <circle cx={lone ? 650 : 110 + (i % 7) * 60} cy={lone ? 160 : 120 + Math.floor(i / 7) * 55} r={11} fill={lone ? `${a}26` : `${MUTED}26`} stroke={lone ? a : MUTED} strokeWidth={1.5} />
        </g>
      );
    })}
    {T(280, 235, "the herd moves together", { anchor: "middle", size: 11.5, fill: FAINT })}
    {T(650, 185, "independent", { anchor: "middle", size: 11.5, fill: a })}
    {T(400, 300, "Social proof feels safe and is priced accordingly. Edge lives where you can stand apart.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const overconfidence: FC = (a) => (
  <g>
    {T(400, 50, "Your “90% sure” is right far less than 90% of the time", { anchor: "middle", size: 14.5, fill: INK, weight: 650 })}
    <line x1={120} y1={260} x2={680} y2={260} stroke={LINE} strokeWidth={1.5} />
    <line x1={120} y1={90} x2={120} y2={260} stroke={LINE} strokeWidth={1.5} />
    <line x1={120} y1={260} x2={680} y2={100} stroke={GOOD} strokeWidth={2} strokeDasharray="5 5" />
    {T(660, 96, "perfect calibration", { anchor: "end", size: 11, fill: GOOD })}
    <path d="M120,260 C300,235 430,210 680,205" fill="none" stroke={a} strokeWidth={2.5} />
    {T(560, 222, "actual: overconfident", { anchor: "middle", size: 11.5, fill: a })}
    {T(118, 80, "right", { anchor: "end", size: 11, fill: FAINT })}
    {T(400, 290, "how sure you felt", { anchor: "middle", size: 11, fill: FAINT })}
    {T(400, 320, "Track your forecasts. Calibration is a skill — and almost everyone starts overconfident.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const orderBook: FC = (a) => {
  const bids = [[ "100.00", 70], ["99.98", 110], ["99.95", 60]] as const;
  const asks = [["100.02", 80], ["100.05", 130], ["100.08", 50]] as const;
  return (
    <g>
      {T(400, 45, "Every price is a queue of buyers and sellers", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {T(200, 90, "BIDS (buyers)", { anchor: "middle", size: 12, fill: GOOD, weight: 650, mono: true })}
      {bids.map((b, i) => (
        <g key={i}>
          <rect x={360 - (b[1] as number) * 1.8} y={108 + i * 34} width={(b[1] as number) * 1.8} height={26} rx={3} fill={`${GOOD}26`} />
          {T(80, 126 + i * 34, b[0] as string, { size: 12, fill: GOOD, mono: true })}
        </g>
      ))}
      {T(600, 90, "ASKS (sellers)", { anchor: "middle", size: 12, fill: BAD, weight: 650, mono: true })}
      {asks.map((b, i) => (
        <g key={i}>
          <rect x={440} y={108 + i * 34} width={(b[1] as number) * 1.8} height={26} rx={3} fill={`${BAD}26`} />
          {T(720, 126 + i * 34, b[0] as string, { anchor: "end", size: 12, fill: BAD, mono: true })}
        </g>
      ))}
      <line x1={400} y1={100} x2={400} y2={220} stroke={a} strokeWidth={1.5} strokeDasharray="3 4" />
      {T(400, 245, "the spread", { anchor: "middle", size: 11.5, fill: a, weight: 600 })}
      {T(400, 300, "A market order crosses the spread and eats the book; a limit order joins the queue.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const bidAsk: FC = (a) => (
  <g>
    {T(400, 50, "You buy at the ask, sell at the bid — the gap is a cost", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <line x1={100} y1={180} x2={700} y2={180} stroke={LINE} strokeWidth={2} />
    <rect x={250} y={165} width={6} height={30} fill={GOOD} />
    {T(250, 150, "bid 99.98", { anchor: "middle", size: 12, fill: GOOD, mono: true })}
    {T(250, 215, "sell here", { anchor: "middle", size: 11, fill: FAINT })}
    <rect x={520} y={165} width={6} height={30} fill={BAD} />
    {T(520, 150, "ask 100.04", { anchor: "middle", size: 12, fill: BAD, mono: true })}
    {T(520, 215, "buy here", { anchor: "middle", size: 11, fill: FAINT })}
    <line x1={256} y1={180} x2={520} y2={180} stroke={a} strokeWidth={3} />
    {T(388, 172, "spread = slippage", { anchor: "middle", size: 11.5, fill: a, weight: 600 })}
    {T(400, 290, "Wide spreads and thin books make trading expensive — liquidity is a real cost.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const shortSelling: FC = (a) => (
  <g>
    {T(400, 45, "Selling first, buying back later", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(70, 100, 200, 75, a)}
    {T(170, 128, "Borrow shares", { anchor: "middle", size: 12.5, fill: a, weight: 600 })}
    {T(170, 152, "sell at $100", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Arrow(270, 137, 320, 137, MUTED)}
    {Box(330, 100, 200, 75, GOOD)}
    {T(430, 128, "Buy back lower", { anchor: "middle", size: 12.5, fill: GOOD, weight: 600 })}
    {T(430, 152, "cover at $70 → profit", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Box(330, 195, 200, 75, BAD)}
    {T(430, 223, "Or it rises…", { anchor: "middle", size: 12.5, fill: BAD, weight: 600 })}
    {T(430, 247, "loss is unbounded", { anchor: "middle", size: 11.5, fill: MUTED })}
    {T(620, 150, "Capped gain,", { size: 12, fill: INK, weight: 600 })}
    {T(620, 170, "unlimited loss —", { size: 12, fill: BAD })}
    {T(620, 190, "the mirror of going long.", { size: 11.5, fill: FAINT })}
    {T(400, 305, "Short squeezes and borrow costs make timing, not just the thesis, decisive.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const etfMechanics: FC = (a) => (
  <g>
    {T(400, 50, "Why an ETF tracks its NAV: arbitrage", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    {Box(90, 120, 180, 90, a)}
    {T(180, 152, "ETF price", { anchor: "middle", size: 12.5, fill: a, weight: 650 })}
    {T(180, 178, "trades all day", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Box(530, 120, 180, 90, GOOD)}
    {T(620, 152, "Basket (NAV)", { anchor: "middle", size: 12.5, fill: GOOD, weight: 650 })}
    {T(620, 178, "the real holdings", { anchor: "middle", size: 11.5, fill: MUTED })}
    {Arrow(280, 150, 520, 150, MUTED)}
    {Arrow(520, 185, 280, 185, MUTED)}
    {T(400, 160, "create", { anchor: "middle", size: 11, fill: FAINT })}
    {T(400, 200, "redeem", { anchor: "middle", size: 11, fill: FAINT })}
    {T(400, 280, "Authorized participants create/redeem shares to capture any gap, pulling price to NAV.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const yieldCurve: FC = (a) => (
  <g>
    {T(40, 50, "The yield curve — and what inversion warns of", { size: 15, fill: INK, weight: 650 })}
    <line x1={80} y1={270} x2={740} y2={270} stroke={LINE} strokeWidth={1.5} />
    <line x1={80} y1={90} x2={80} y2={270} stroke={LINE} strokeWidth={1.5} />
    <path d="M90,210 C250,150 500,120 730,110" fill="none" stroke={a} strokeWidth={2.5} />
    {T(720, 100, "normal: upward", { anchor: "end", size: 11.5, fill: a })}
    <path d="M90,150 C300,180 520,205 730,225" fill="none" stroke={BAD} strokeWidth={2.5} strokeDasharray="5 4" />
    {T(720, 240, "inverted: short > long", { anchor: "end", size: 11.5, fill: BAD })}
    {T(110, 290, "3M", { size: 11, fill: FAINT, mono: true })}
    {T(720, 290, "30Y", { anchor: "end", size: 11, fill: FAINT, mono: true })}
    {T(400, 320, "Inversions have preceded most recessions — the market pricing rate cuts ahead.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const businessCycle: FC = (a) => {
  const phases = [["Early", GOOD], ["Mid", a], ["Late", WARN], ["Recession", BAD]] as const;
  return (
    <g>
      {T(400, 45, "Sectors lead and lag the business cycle", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      <path d="M70,200 C180,120 260,120 380,200 C500,280 580,280 700,180" fill="none" stroke={MUTED} strokeWidth={2} />
      {phases.map((p, i) => {
        const x = 110 + i * 175;
        return (
          <g key={i}>
            <circle cx={x} cy={235} r={5} fill={p[1] as string} />
            {T(x, 258, p[0] as string, { anchor: "middle", size: 12, fill: p[1] as string, weight: 600 })}
          </g>
        );
      })}
      {T(150, 290, "rate-sensitives", { anchor: "middle", size: 10.5, fill: FAINT })}
      {T(325, 290, "industrials", { anchor: "middle", size: 10.5, fill: FAINT })}
      {T(500, 290, "energy/staples", { anchor: "middle", size: 10.5, fill: FAINT })}
      {T(660, 290, "defensives", { anchor: "middle", size: 10.5, fill: FAINT })}
      {T(400, 320, "Leadership rotates predictably-ish — but the turns are far easier to see in hindsight.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const inflationFig: FC = (a) => (
  <g>
    {T(40, 50, "Inflation is a silent tax on idle money", { size: 15, fill: INK, weight: 650 })}
    <path d="M70,120 C250,150 450,200 740,250" fill="none" stroke={a} strokeWidth={2.5} />
    {T(80, 110, "$100 today", { size: 12, fill: a, weight: 600 })}
    {T(736, 240, "buys ~$55 in 20 yrs at 3%", { anchor: "end", size: 12, fill: BAD, weight: 600 })}
    <line x1={70} y1={270} x2={740} y2={270} stroke={LINE} strokeWidth={1.5} />
    {T(400, 300, "Real return = nominal − inflation. Cash that doesn't out-earn inflation quietly loses ground.", { anchor: "middle", size: 11.5, fill: FAINT })}
  </g>
);

const fourRegimes: FC = (a) => {
  const cells = [
    ["Growth ↑  Inflation ↑", "Stocks, commodities", 60, 60, GOOD],
    ["Growth ↑  Inflation ↓", "Stocks, long bonds", 420, 60, a],
    ["Growth ↓  Inflation ↑", "Commodities, cash, gold", 60, 185, WARN],
    ["Growth ↓  Inflation ↓", "Long bonds, quality", 420, 185, BAD],
  ] as const;
  return (
    <g>
      {T(400, 45, "Four regimes: growth and inflation, up or down", { anchor: "middle", size: 14.5, fill: INK, weight: 650 })}
      {cells.map((c, i) => (
        <g key={i}>
          <rect x={c[2] as number} y={c[3] as number} width={320} height={110} rx={8} fill={`${c[4]}14`} stroke={c[4] as string} strokeWidth={1.5} />
          {T((c[2] as number) + 160, (c[3] as number) + 42, c[0] as string, { anchor: "middle", size: 12.5, fill: c[4] as string, weight: 650 })}
          {T((c[2] as number) + 160, (c[3] as number) + 72, c[1] as string, { anchor: "middle", size: 11.5, fill: MUTED })}
        </g>
      ))}
      {T(400, 325, "Different assets win in each quadrant — which is why “diversified” depends on the regime.", { anchor: "middle", size: 11, fill: FAINT })}
    </g>
  );
};

const riskLadder: FC = (a) => {
  const rungs = [["Cash / T-bills", 20, GOOD], ["Bonds", 40, "#38bdf8"], ["Broad index funds", 60, a], ["Individual stocks", 80, WARN], ["Options / leverage", 100, BAD]] as const;
  return (
    <g>
      {T(400, 50, "More expected return rides on more risk", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
      {rungs.map((r, i) => {
        const y = 240 - i * 36;
        return (
          <g key={i}>
            <rect x={120} y={y - 14} width={(r[1] as number) / 100 * 520} height={24} rx={4} fill={`${r[2]}26`} stroke={r[2] as string} strokeWidth={1.25} />
            {T(130, y + 3, r[0] as string, { size: 12.5, fill: INK })}
          </g>
        );
      })}
      {T(120, 290, "lower risk / lower return", { size: 11, fill: GOOD })}
      {T(660, 90, "higher risk", { anchor: "end", size: 11, fill: BAD })}
      {T(400, 315, "There's no free lunch — judge whether the extra return justifies the extra risk.", { anchor: "middle", size: 11.5, fill: FAINT })}
    </g>
  );
};

const indexVsActive: FC = (a) => (
  <g>
    {T(400, 50, "Most active funds trail the index after fees", { anchor: "middle", size: 15, fill: INK, weight: 650 })}
    <rect x={150} y={120} width={200} height={120} rx={8} fill={`${a}1f`} stroke={a} strokeWidth={1.5} />
    {T(250, 165, "Index fund", { anchor: "middle", size: 13, fill: a, weight: 650 })}
    {T(250, 195, "~0.03% fee", { anchor: "middle", size: 12, fill: MUTED, mono: true })}
    {T(250, 220, "the market return", { anchor: "middle", size: 11, fill: FAINT })}
    <rect x={450} y={120} width={200} height={120} rx={8} fill={FILL} stroke={LINE} strokeWidth={1.5} />
    {T(550, 165, "Active fund", { anchor: "middle", size: 13, fill: INK, weight: 650 })}
    {T(550, 195, "~0.7% fee", { anchor: "middle", size: 12, fill: WARN, mono: true })}
    {T(550, 220, "most lag over 10+ yrs", { anchor: "middle", size: 11, fill: FAINT })}
    {T(400, 290, "Fees compound against you. The bar to justify active management is high.", { anchor: "middle", size: 11.5, fill: FAINT })}
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
  // ── Expansion ──
  "second-order": secondOrder,
  "base-rate": baseRate,
  reflexivity: reflexivity,
  sentiment: sentiment,
  compounding: compounding,
  drawdown: drawdown,
  correlation: correlation,
  kelly: kelly,
  "expected-value": expectedValue,
  "reverse-dcf": reverseDcf,
  segment: segment,
  goodwill: goodwill,
  leases: leases,
  "stock-comp": stockComp,
  "unit-economics": unitEconomics,
  "capital-allocation": capitalAllocation,
  forensic: forensic,
  "operating-leverage": operatingLeverageFig,
  sotp: sotp,
  "normalized-earnings": normalizedEarnings,
  "dividend-discount": dividendDiscount,
  inversion: inversion,
  incentives: incentives,
  bayes: bayes,
  anchoring: anchoring,
  disposition: disposition,
  herding: herding,
  overconfidence: overconfidence,
  "order-book": orderBook,
  "bid-ask": bidAsk,
  "short-selling": shortSelling,
  "etf-mechanics": etfMechanics,
  "yield-curve": yieldCurve,
  "business-cycle": businessCycle,
  inflation: inflationFig,
  "four-regimes": fourRegimes,
  "risk-ladder": riskLadder,
  "index-vs-active": indexVsActive,
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
