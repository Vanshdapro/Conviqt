"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

// Light is the brand default; dark is opt-in and remembered. The actual token
// swap happens by setting data-theme="dark" on <html> (see tokens.css). The
// no-flash script in layout.tsx applies the stored choice before first paint;
// this control just flips it and persists the choice.
const STORAGE_KEY = "conviqt-theme";

// Keep the mobile status-bar / address-bar colour in step with the surface.
const THEME_COLOR = { light: "#F5EFE1", dark: "#161210" } as const;

// The logged-in shell paints a bottom tab bar on mobile; lift the toggle above
// it there so it never sits under the tabs. Mirrors SHELL_PREFIXES in AppShell.
const SHELL_PREFIXES = [
  "/research", "/dashboard", "/headlines", "/portfolio", "/academy",
  "/chat", "/dev",
];
function onShellRoute(p: string): boolean {
  return SHELL_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));
}

export function ThemeToggle() {
  const pathname = usePathname() ?? "/";
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Read the real applied theme on mount (the no-flash script may have already
  // set data-theme="dark"). Until then we render the light-state icon, which
  // matches the server render and avoids a hydration mismatch.
  useEffect(() => {
    setMounted(true);
    const applied =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light";
    setTheme(applied);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    if (next === "dark") root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked (private mode) — the toggle still works for the session */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_COLOR[next]);
    console.log(`[theme] switched to ${next}`);
  };

  const isDark = mounted && theme === "dark";
  const className =
    "cvq-theme-toggle" + (onShellRoute(pathname) ? " cvq-theme-toggle--shell" : "");

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        // Sun — clicking returns to light
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.7" />
          <path
            d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        // Moon — clicking switches to dark
        <svg viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 13.6A8 8 0 1 1 10.4 4a6.3 6.3 0 0 0 9.6 9.6Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
