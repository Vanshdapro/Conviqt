"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunNowButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const router = useRouter();

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/alpha/trigger", { method: "POST" });
      if (res.ok) {
        setStatus("ok");
        setTimeout(() => router.refresh(), 800);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mono text-[11px] px-3 py-1 rounded transition-colors disabled:opacity-50"
      style={{
        background: status === "ok" ? "rgba(16,185,129,0.12)" : status === "error" ? "rgba(244,63,94,0.12)" : "var(--accent-dim)",
        border: `1px solid ${status === "ok" ? "rgba(16,185,129,0.3)" : status === "error" ? "rgba(244,63,94,0.3)" : "var(--accent-border)"}`,
        color: status === "ok" ? "var(--bull)" : status === "error" ? "var(--bear)" : "var(--accent)",
        cursor: loading ? "wait" : "pointer",
      }}
    >
      {loading ? "Running…" : status === "ok" ? "Done ✓" : status === "error" ? "Error" : "Run Now"}
    </button>
  );
}
