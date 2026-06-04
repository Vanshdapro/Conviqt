"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/i18n/languages";
import { useLang } from "./TranslationProvider";

// The "Conviqt Translate" control. A compact pill that opens a menu of the
// supported languages (shown in their own script). The whole control is marked
// `data-no-translate` so its labels always read natively, whatever language the
// rest of the site is in.

export function LanguageSwitcher() {
  const { lang, setLang, translating } = useLang();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} data-no-translate translate="no" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Translate this site"
        title="Translate this site"
        className="cvq-lang-btn"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: "11px",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#e8edf8",
          background: "transparent",
          border: "1px solid rgba(232,237,248,0.55)",
          borderRadius: "100px",
          padding: "9px 15px",
          cursor: "pointer",
          whiteSpace: "nowrap",
          lineHeight: 1,
          opacity: translating ? 0.65 : 1,
          transition: "opacity 0.2s ease",
        }}
      >
        <GlobeIcon spinning={translating} />
        <span className="cvq-lang-label">{current.native}</span>
        <svg width="9" height="6" viewBox="0 0 10 6" aria-hidden style={{ opacity: 0.6 }}>
          <path d="M1 1l4 4 4-4" fill="none" stroke="#e8edf8" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Choose a language"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            zIndex: 200,
            minWidth: "208px",
            listStyle: "none",
            margin: 0,
            padding: "6px",
            background: "rgba(8,16,30,0.98)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: "1px solid rgba(232,237,248,0.12)",
            borderRadius: "14px",
            boxShadow: "0 20px 54px rgba(0,0,0,0.55)",
          }}
        >
          {LANGUAGES.map((l) => {
            const active = l.code === lang;
            return (
              <li key={l.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLang(l.code);
                    setOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    gap: "12px",
                    padding: "9px 12px",
                    background: active ? "rgba(79,135,247,0.15)" : "transparent",
                    border: "none",
                    borderRadius: "9px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#e8edf8",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(232,237,248,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                    <span
                      dir={l.dir}
                      style={{ fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 500 }}
                    >
                      {l.native}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: "11px",
                        color: "#7a92b8",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {l.label}
                    </span>
                  </span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                      <path
                        d="M2 7.5l3.2 3.2L12 4"
                        fill="none"
                        stroke="#4f87f7"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
          <li
            style={{
              padding: "9px 12px 5px",
              marginTop: "4px",
              borderTop: "1px solid rgba(232,237,248,0.08)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "10px",
                color: "#3d5278",
                letterSpacing: "0.04em",
              }}
            >
              {translating ? "Translating…" : "Auto-translated · English is the source"}
            </span>
          </li>
        </ul>
      )}

      <style>{`
        @media (max-width: 680px) { .cvq-lang-label { display: none; } }
        @keyframes cvq-globe-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function GlobeIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      style={
        spinning
          ? { animation: "cvq-globe-spin 1.1s linear infinite", transformOrigin: "center" }
          : undefined
      }
    >
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1.6 8h12.8M8 1.6c1.85 1.95 2.8 4 2.8 6.4S9.85 12.45 8 14.4C6.15 12.45 5.2 10.4 5.2 8S6.15 3.55 8 1.6z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
