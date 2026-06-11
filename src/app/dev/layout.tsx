import type { Metadata } from "next";

// /dev/* are internal design surfaces (the kitchen sink). Keep them out of
// search even though the rebuild is local-only — belt and suspenders.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DevLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
