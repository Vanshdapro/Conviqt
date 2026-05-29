import Link from "next/link";

// Shared dark-themed shell for the /login and /signup screens.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050d1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-display), Georgia, serif",
          fontWeight: 400,
          fontSize: 18,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#e8edf8",
          textDecoration: "none",
          marginBottom: 36,
        }}
      >
        Conviqt
      </Link>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(10,19,35,0.7)",
          border: "1px solid rgba(232,237,248,0.08)",
          borderRadius: 16,
          padding: "32px 28px",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: "-0.01em",
            color: "#e8edf8",
            margin: "0 0 6px",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 14,
            color: "rgba(232,237,248,0.55)",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>

        {children}
      </div>

      <div
        style={{
          marginTop: 20,
          fontFamily: "var(--font-serif), Georgia, serif",
          fontSize: 13,
          color: "rgba(232,237,248,0.5)",
        }}
      >
        {footer}
      </div>
    </div>
  );
}

export const authInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(5,13,26,0.6)",
  border: "1px solid rgba(232,237,248,0.12)",
  borderRadius: 10,
  padding: "11px 14px",
  fontFamily: "var(--font-sans), system-ui, sans-serif",
  fontSize: 14,
  color: "#e8edf8",
  outline: "none",
};

export const authLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(232,237,248,0.45)",
  marginBottom: 7,
};

export const authButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  padding: "12px 20px",
  fontFamily: "var(--font-sans), system-ui, sans-serif",
  fontWeight: 600,
  fontSize: 14,
  background: "#4f87f7",
  color: "#050d1a",
  border: "none",
  cursor: "pointer",
  transition: "opacity 0.2s",
};
