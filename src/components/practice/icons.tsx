// Conviqt Academy — Practice icon set. Same conventions as the Learn set:
// 1.75 stroke, currentColor, 24-box. No emoji.

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

export function ArrowRightIcon(p: IconProps) {
  return <Svg {...p}><line x1="4" y1="12" x2="18.5" y2="12" /><polyline points="12.5 6 18.5 12 12.5 18" /></Svg>;
}

export function ArrowLeftIcon(p: IconProps) {
  return <Svg {...p}><line x1="20" y1="12" x2="5.5" y2="12" /><polyline points="11.5 6 5.5 12 11.5 18" /></Svg>;
}

export function CheckIcon(p: IconProps) {
  return <Svg {...p}><polyline points="4.5 12.5 9.5 17.5 19.5 6.5" /></Svg>;
}

export function LockIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="5" y="10.5" width="14" height="10" rx="1.6" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <circle cx="12" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function StarIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p} fill={filled ? "currentColor" : "none"}>
      <polygon points="12 3.2 14.7 9 21 9.7 16.3 14 17.6 20.4 12 17.1 6.4 20.4 7.7 14 3 9.7 9.3 9" />
    </Svg>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path d="M12 13v4M9 21h6M10 17.5h4l.5 3.5h-5l.5-3.5Z" />
    </Svg>
  );
}

export function TargetIcon(p: IconProps) {
  return <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" /></Svg>;
}

export function ShieldIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.2 19 6v5.2c0 4.4-3 7.4-7 8.6-4-1.2-7-4.2-7-8.6V6l7-2.8Z" />
      <polyline points="9 11.5 11.2 13.7 15 9.7" />
    </Svg>
  );
}

export function BoltIcon(p: IconProps) {
  return <Svg {...p}><polygon points="13 3 5 13 11 13 10 21 19 10 13 10 13 3" fill="currentColor" stroke="none" /></Svg>;
}

export function TrendingUpIcon(p: IconProps) {
  return <Svg {...p}><polyline points="3 16.5 9.5 10 13 13.5 21 5.5" /><polyline points="15 5.5 21 5.5 21 11.5" /></Svg>;
}

export function TrendingDownIcon(p: IconProps) {
  return <Svg {...p}><polyline points="3 7.5 9.5 14 13 10.5 21 18.5" /><polyline points="15 18.5 21 18.5 21 12.5" /></Svg>;
}

export function ReplayIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <polyline points="20 3.5 20 7.5 16 7.5" />
    </Svg>
  );
}

export function ChartIcon(p: IconProps) {
  return <Svg {...p}><path d="M4 4v16h16" /><polyline points="7 14 11 9 14 12 19 6" /></Svg>;
}

export function PenIcon(p: IconProps) {
  return <Svg {...p}><path d="M14.5 5.5 18.5 9.5 8 20H4v-4L14.5 5.5Z" /><line x1="13" y1="7" x2="17" y2="11" /></Svg>;
}

export function FlagIcon(p: IconProps) {
  return <Svg {...p}><path d="M6 21V4M6 4h11l-2 3.5L17 11H6" /></Svg>;
}

export function CoinsIcon(p: IconProps) {
  return <Svg {...p}><ellipse cx="9" cy="7" rx="5.5" ry="2.6" /><path d="M3.5 7v4c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V7" /><path d="M9.2 13.5c.6 2 3 3 6 3 3 0 5.5-1.2 5.5-2.6v-4c0-1.2-1.8-2.2-4.3-2.5" /></Svg>;
}

export function ChevronRightIcon(p: IconProps) {
  return <Svg {...p}><polyline points="9 5 16 12 9 19" /></Svg>;
}

export function SparkIcon(p: IconProps) {
  return <Svg {...p}><path d="M12 3v18M3 12h18M6 6l12 12M18 6 6 18" /></Svg>;
}
