"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track, captureUtmFirstTouch } from "@/lib/analytics/track";

// Mounted once in the root layout. Captures first-touch UTM on first load and
// fires a page_view on every client navigation. Renders nothing — uses
// usePathname (not useSearchParams) so it never forces a Suspense boundary or
// opts statically-generated pages out of prerendering.
export default function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    captureUtmFirstTouch();
    // Activate the deferred Noto script-fallback sheet: the layout renders it
    // with media="print" so it doesn't block first paint (the brand Latin fonts
    // are self-hosted via next/font and need no flip). Flipping to "all" here
    // (post-hydration) applies it with no SSR/client attribute mismatch.
    const noto = document.getElementById("cvq-fonts-noto") as HTMLLinkElement | null;
    if (noto) noto.media = "all";
  }, []);

  useEffect(() => {
    if (!pathname) return;
    // Don't count the owner looking at their own dashboard.
    if (pathname.startsWith("/admin")) return;
    track("page_view");
  }, [pathname]);

  return null;
}
