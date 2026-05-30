// Conviqt Learn — a small, consistent line-icon set (1.75 stroke, currentColor)
// used across the dashboard and lesson view. No emoji: icons inherit the brand
// accent and theme correctly, the way the rest of Conviqt's UI does.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── Track glyphs ─────────────────────────────────────────────────────────────

export function WalletIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8.5A2 2 0 0 1 5 6.5h12a1.5 1.5 0 0 1 0 3" />
      <path d="M3 8.5v9A1.5 1.5 0 0 0 4.5 19h14A1.5 1.5 0 0 0 20 17.5v-7A1.5 1.5 0 0 0 18.5 9H4.5" />
      <circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function TrendingUpIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="3 16.5 9.5 10 13 13.5 21 5.5" />
      <polyline points="15 5.5 21 5.5 21 11.5" />
    </Svg>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="20.5" y1="20.5" x2="15.5" y2="15.5" />
    </Svg>
  );
}

export function NetworkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M8 7.4 11 15.8M16 7.4 13 15.8M8.4 6h7.2" />
    </Svg>
  );
}

export function ShieldIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.2 19 6v5.2c0 4.4-3 7.4-7 8.6-4-1.2-7-4.2-7-8.6V6l7-2.8Z" />
      <polyline points="9 11.5 11.2 13.7 15 9.7" />
    </Svg>
  );
}

// ── Utility glyphs ───────────────────────────────────────────────────────────

export function CheckIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <polyline points="4.5 12.5 9.5 17.5 19.5 6.5" />
    </Svg>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <line x1="4" y1="12" x2="18.5" y2="12" />
      <polyline points="12.5 6 18.5 12 12.5 18" />
    </Svg>
  );
}

export function SparkIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function PlayIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <polygon points="7 4.5 19 12 7 19.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function BookIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v15.5H5.5A1.5 1.5 0 0 0 4 21V5.5Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v15.5h6.5A1.5 1.5 0 0 1 20 21V5.5Z" />
    </Svg>
  );
}

// Maps a curriculum track id to its glyph. Falls back to the book.
export function TrackIcon({ trackId, size = 20, ...rest }: IconProps & { trackId: string }) {
  switch (trackId) {
    case "money-basics":
      return <WalletIcon size={size} {...rest} />;
    case "investing-101":
      return <TrendingUpIcon size={size} {...rest} />;
    case "reading-market":
      return <SearchIcon size={size} {...rest} />;
    case "how-conviqt-thinks":
      return <NetworkIcon size={size} {...rest} />;
    case "smart-and-safe":
      return <ShieldIcon size={size} {...rest} />;
    default:
      return <BookIcon size={size} {...rest} />;
  }
}
