import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Sign up for Conviqt — 50 free credits every month. Run AI equity research on any stock, no card required.",
  alternates: { canonical: "https://www.conviqt.com/signup" },
  openGraph: {
    title: "Create your account | Conviqt",
    description: "Start with 50 free credits. No card required.",
    url: "https://www.conviqt.com/signup",
    type: "website",
  },
};

export default function SignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
