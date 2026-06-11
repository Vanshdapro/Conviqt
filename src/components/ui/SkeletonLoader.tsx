import type { CSSProperties } from "react";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** Skeleton — a single warm shimmer block (the loading placeholder unit). */
export function Skeleton({
  width = "100%",
  height = 16,
  radius,
  circle = false,
  className = "",
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={`cvq-skeleton ${className}`}
      style={{
        display: "block",
        width,
        height,
        borderRadius: circle ? "var(--radius-pill)" : radius ?? "var(--radius-control)",
        ...style,
      }}
    />
  );
}

/** SkeletonText — n shimmer lines; the last is shortened like real prose. */
export function SkeletonText({
  lines = 3,
  gap = 10,
}: {
  lines?: number;
  gap?: number;
}) {
  return (
    <span style={{ display: "flex", flexDirection: "column", gap }} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? "62%" : "100%"} />
      ))}
    </span>
  );
}

/** SkeletonLoader — a ready-made loading card matching the Card primitive. */
export function SkeletonLoader() {
  return (
    <div className="cvq-card" role="status" aria-label="Loading">
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <Skeleton width={36} height={36} circle />
        <span style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Skeleton width="40%" height={12} />
          <Skeleton width="68%" height={10} />
        </span>
      </div>
      <div style={{ marginTop: "var(--space-5)" }}>
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}
