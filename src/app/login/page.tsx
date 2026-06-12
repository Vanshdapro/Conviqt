"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AuthShell,
  authInputStyle,
  authLabelStyle,
  authButtonStyle,
} from "@/components/AuthShell";

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/research";
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setError(
          error.message === "Email not confirmed"
            ? "Please verify your email first — check your inbox (and spam folder) for the confirmation link."
            : "Incorrect email or password."
        );
        setLoading(false);
        return;
      }

      // Full page navigation ensures the new session cookie is read server-side
      // on the very first request after sign-in (router.push alone can race).
      window.location.href = next;
    } catch {
      setError("Network error — check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up your research where you left off."
      footer={
        <>
          New to Conviqt?{" "}
          <Link href={`/signup?next=${encodeURIComponent(next)}`} style={{ color: "var(--link)" }}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={authLabelStyle}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={authInputStyle}
            autoComplete="email"
          />
        </div>
        <div>
          <label style={authLabelStyle}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={authInputStyle}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "var(--down-ink)", margin: 0, fontFamily: "var(--font-ui), sans-serif" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{ ...authButtonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
