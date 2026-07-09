"use client";

import { useState, type FormEvent } from "react";

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "granted" }
  | { kind: "alreadyPro" }
  | { kind: "signin" }
  | { kind: "error"; message: string };

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 401) return setState({ kind: "signin" });
      if (res.ok && data?.alreadyPro) return setState({ kind: "alreadyPro" });
      if (res.ok && data?.granted) return setState({ kind: "granted" });
      setState({
        kind: "error",
        message:
          typeof data?.error === "string"
            ? data.error
            : "Something went wrong. Please try again.",
      });
    } catch {
      setState({ kind: "error", message: "Something went wrong. Please try again." });
    }
  }

  const done = state.kind === "granted" || state.kind === "alreadyPro";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        color: "var(--text)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 2px 8px rgba(42,28,21,.06)",
          padding: 32,
        }}
      >
        <p
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Conviqt Pro · Edge members
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontSize: 30,
            lineHeight: 1.1,
            margin: "10px 0 0",
            color: "var(--text)",
          }}
        >
          Redeem your Edge code
        </h1>

        {done ? (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>
              {state.kind === "granted"
                ? "You're in — Conviqt Pro is unlocked on this account, free, as part of your Edge membership."
                : "You already have Conviqt Pro on this account. Nothing to redeem."}
            </p>
            <a
              href="/research"
              style={{
                display: "inline-block",
                marginTop: 20,
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontWeight: 600,
                fontSize: 15,
                padding: "12px 22px",
                borderRadius: 9,
                textDecoration: "none",
              }}
            >
              Start researching
            </a>
          </div>
        ) : state.kind === "signin" ? (
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 16, lineHeight: 1.6, margin: 0 }}>
              Sign in to Conviqt first, then come back and redeem your code.
            </p>
            <a
              href="/research"
              style={{
                display: "inline-block",
                marginTop: 20,
                background: "var(--accent)",
                color: "var(--on-accent)",
                fontWeight: 600,
                fontSize: 15,
                padding: "12px 22px",
                borderRadius: 9,
                textDecoration: "none",
              }}
            >
              Sign in to Conviqt
            </a>
          </div>
        ) : (
          <>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--text-muted)",
                margin: "12px 0 20px",
              }}
            >
              Founding members of Edge get Conviqt Pro free. Enter the code from
              your Edge portal to unlock it on this account.
            </p>
            <form onSubmit={onSubmit}>
              <label
                htmlFor="edge-code"
                style={{
                  display: "block",
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                Edge code
              </label>
              <input
                id="edge-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EDGE-XXXXXX"
                autoComplete="off"
                spellCheck={false}
                style={{
                  width: "100%",
                  height: 46,
                  padding: "0 14px",
                  background: "var(--bg-sunken)",
                  border: "1px solid var(--border)",
                  borderRadius: 9,
                  fontSize: 16,
                  letterSpacing: "0.06em",
                  color: "var(--text)",
                  outline: "none",
                }}
              />
              {state.kind === "error" && (
                <p style={{ color: "var(--down-ink)", fontSize: 14, margin: "10px 0 0" }}>
                  {state.message}
                </p>
              )}
              <button
                type="submit"
                disabled={state.kind === "submitting"}
                style={{
                  width: "100%",
                  marginTop: 16,
                  height: 46,
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                  fontWeight: 600,
                  fontSize: 15,
                  border: "none",
                  borderRadius: 9,
                  cursor: state.kind === "submitting" ? "default" : "pointer",
                  opacity: state.kind === "submitting" ? 0.6 : 1,
                }}
              >
                {state.kind === "submitting" ? "Redeeming…" : "Redeem Conviqt Pro"}
              </button>
            </form>
          </>
        )}

        <p
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "var(--text-muted)",
            margin: "20px 0 0",
          }}
        >
          Conviqt is a research and education tool, not a licensed financial
          adviser. Nothing here is financial advice. Markets involve risk.
        </p>
      </div>
    </main>
  );
}
