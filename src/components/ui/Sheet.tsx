"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** accessible label when no visible title is shown */
  ariaLabel?: string;
};

/**
 * Sheet — a side panel on desktop, a bottom sheet on mobile (the responsive
 * split lives in app.css). Used for the Skill Library, the AI Health Check,
 * Academy lesson popovers, etc. Closes on Escape, overlay click, and the ✕.
 */
export function Sheet({ open, onClose, title, children, ariaLabel }: SheetProps) {
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the sheet is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="cvq-sheet-overlay"
      onClick={onClose}
      role="presentation"
    >
      <aside
        className="cvq-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : ariaLabel ?? "Panel"}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cvq-sheet-head">
          <span className="cvq-sheet-title">{title}</span>
          <button
            ref={closeRef}
            type="button"
            className="cvq-sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="cvq-sheet-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
