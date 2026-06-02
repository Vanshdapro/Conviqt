import type { Metadata } from "next";
import IntroAnimation from "@/components/3d/IntroAnimation";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.conviqt.com" },
};

export default function Home() {
  return <IntroAnimation />;
}
