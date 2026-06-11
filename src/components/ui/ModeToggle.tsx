"use client";

import type { ReactNode } from "react";

export type ModeOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type ModeToggleProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  /** defaults to the Research surface's Council / Flash pair */
  options?: ModeOption<T>[];
  ariaLabel?: string;
};

const BoltIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />
  </svg>
);

const LayersIcon = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const DEFAULT_OPTIONS = [
  { value: "council", label: "Council", icon: LayersIcon },
  { value: "flash", label: "Flash", icon: BoltIcon },
] as const;

/**
 * ModeToggle — a segmented control. The Research surface uses it for the
 * Council (deep) / Flash (instant) choice; generic over any string union.
 */
export function ModeToggle<T extends string>({
  value,
  onChange,
  options,
  ariaLabel = "Mode",
}: ModeToggleProps<T>) {
  const opts = (options ?? (DEFAULT_OPTIONS as unknown as ModeOption<T>[]));
  return (
    <div className="cvq-modetoggle" role="group" aria-label={ariaLabel}>
      {opts.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="cvq-modetoggle-opt"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
