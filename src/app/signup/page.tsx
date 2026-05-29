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

function SignupInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/chat";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${email}. Click it to activate your account and claim your 50 free credits.`}
        footer={
          <>
            Wrong email?{" "}
            <button
              onClick={() => setSent(false)}
              style={{ color: "#4f87f7", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            >
              Go back
            </button>
          </>
        }
      >
        <div
          style={{
            background: "rgba(79,135,247,0.08)",
            border: "1px solid rgba(79,135,247,0.2)",
            borderRadius: 10,
            padding: "16px",
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 13,
            color: "rgba(232,237,248,0.7)",
            lineHeight: 1.6,
          }}
        >
          You won&apos;t be able to sign in until your email is verified. The link
          expires after a while — if it does, just sign up again.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start with 50 free credits every month. No card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} style={{ color: "#4f87f7" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={authLabelStyle}>Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Investor"
            style={authInputStyle}
            autoComplete="name"
          />
        </div>
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
            placeholder="At least 8 characters"
            style={authInputStyle}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "#f87171", margin: 0, fontFamily: "var(--font-sans), sans-serif" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{ ...authButtonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
