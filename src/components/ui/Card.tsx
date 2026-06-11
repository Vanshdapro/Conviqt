import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  /** surface = brighter warm white (default); sunken = Sand-Dune well */
  tone?: "surface" | "sunken";
  /** add the single permitted soft shadow on top of the tone+border lift */
  raised?: boolean;
  /** hover lift for clickable cards */
  interactive?: boolean;
  padding?: "default" | "lg" | "none";
  className?: string;
  style?: CSSProperties;
};

/**
 * Card — the base surface. Almanac elevation is TONE + 1px border, not shadow;
 * `raised` only adds the max-allowed 0 2px 8px espresso-tinted shadow.
 */
export function Card({
  children,
  tone = "surface",
  raised = false,
  interactive = false,
  padding = "default",
  className = "",
  style,
}: CardProps) {
  const classes = [
    "cvq-card",
    tone === "sunken" && "cvq-card--sunken",
    raised && "cvq-card--raised",
    interactive && "cvq-card--interactive",
    padding === "lg" && "cvq-card--pad-lg",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={padding === "none" ? { padding: 0, ...style } : style}
    >
      {children}
    </div>
  );
}
