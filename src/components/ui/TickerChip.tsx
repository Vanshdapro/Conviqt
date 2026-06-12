import type { ReactNode } from "react";

type Direction = "up" | "down" | "flat";

function directionOf(change?: number): Direction {
  if (change === undefined || change === null || Number.isNaN(change)) return "flat";
  if (change > 0) return "up";
  if (change < 0) return "down";
  return "flat";
}

/** Round to the 2dp the UI displays, so the arrow/tint and the text can never
    disagree (a raw −0.004 must not render as a red "−0.00%" pill). */
function displayChange(change?: number): number | undefined {
  if (change === undefined || change === null || Number.isNaN(change)) return undefined;
  return Math.round(change * 100) / 100;
}

const ARROW: Record<Direction, string> = { up: "▲", down: "▼", flat: "▬" };

function fmtPct(change: number): string {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "";
  return `${sign}${Math.abs(change).toFixed(2)}%`;
}

function fmtPrice(price: number | string | undefined, currency: string): string | undefined {
  if (price === undefined || price === null) return undefined;
  if (typeof price === "string") return price;
  return `${currency}${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * ChangePill — gain/loss as a tinted PILL: up-ink on up-weak, down-ink on
 * down-weak, ALWAYS with a ▲/▼ arrow so meaning never relies on hue alone.
 */
export function ChangePill({
  change,
  label,
}: {
  change?: number;
  /** override the auto-formatted "+2.57%" text */
  label?: ReactNode;
}) {
  const shown = displayChange(change);
  const dir = directionOf(shown);
  return (
    <span className={`cvq-pill cvq-pill--${dir}`}>
      <span className="cvq-pill-arrow" aria-hidden>
        {ARROW[dir]}
      </span>
      {label ?? (shown !== undefined ? fmtPct(shown) : "—")}
    </span>
  );
}

/** Inline change text (no pill) — up-ink / down-ink, still arrow-prefixed. */
export function ChangeText({ change, label }: { change?: number; label?: ReactNode }) {
  const shown = displayChange(change);
  const dir = directionOf(shown);
  if (dir === "flat") {
    // A real 0.00% still reads as a number — "—" is reserved for no data.
    return <span className="cvq-delta">{label ?? (shown !== undefined ? fmtPct(shown) : "—")}</span>;
  }
  return (
    <span className={`cvq-delta cvq-delta--${dir}`}>
      <span aria-hidden>{ARROW[dir]} </span>
      {label ?? fmtPct(shown as number)}
    </span>
  );
}

type TickerChipProps = {
  symbol?: string;
  price?: number | string;
  /** percent change, e.g. 2.57 or -1.4 */
  change?: number;
  /** absolute change text shown under the pill, e.g. "+4.21" — optional */
  changeAbsLabel?: string;
  /** render the change inline instead of as a pill */
  pill?: boolean;
  currency?: string;
};

/**
 * TickerChip — symbol + price + change. The change is the tinted pill by
 * default; pass pill={false} for the inline-ink variant.
 */
export function TickerChip({
  symbol,
  price,
  change,
  changeAbsLabel,
  pill = true,
  currency = "$",
}: TickerChipProps) {
  const priceText = fmtPrice(price, currency);
  return (
    <span className="cvq-tickerchip">
      {symbol && (
        <span className="cvq-ticker-sym">
          {symbol}
        </span>
      )}
      {priceText && <span className="cvq-ticker-price">{priceText}</span>}
      {change !== undefined &&
        (pill ? (
          <ChangePill change={change} label={changeAbsLabel} />
        ) : (
          <ChangeText change={change} label={changeAbsLabel} />
        ))}
    </span>
  );
}
