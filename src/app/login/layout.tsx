import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in",
  description: "Log in to Conviqt to run AI equity research on any stock.",
  alternates: { canonical: "https://www.conviqt.com/login" },
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
