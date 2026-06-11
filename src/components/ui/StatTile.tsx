import type { ReactNode } from "react";

type StatTileProps = {
  label: string;
  value: ReactNode;
  /** secondary line under the value — e.g. a ChangePill or a caption */
  sub?: ReactNode;
  /**
   * If provided, renders an ⓘ affordance next to the label. The portfolio
   * surface (Phase 5) wires this to open the matching Academy lesson; here it
   * is just a labelled button.
   */
  onInfo?: () => void;
  infoLabel?: string;
};

/**
 * StatTile — one number with its label, the unit of the stats strips
 * (Beta · Volatility · Max Drawdown · Sharpe, market snapshot, etc.).
 */
export function StatTile({ label, value, sub, onInfo, infoLabel }: StatTileProps) {
  return (
    <div className="cvq-stat">
      <div className="cvq-stat-label">
        {label}
        {onInfo && (
          <button
            type="button"
            className="cvq-stat-info"
            onClick={onInfo}
            aria-label={infoLabel ?? `What is ${label}?`}
          >
            i
          </button>
        )}
      </div>
      <div className="cvq-stat-value">{value}</div>
      {sub && <div className="cvq-stat-sub">{sub}</div>}
    </div>
  );
}
