import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // An orphan stub lockfile sits in the parent folder (~/Desktop/Conviqt/), so
  // Next otherwise infers the workspace root one level too high. Pin it to this
  // project to silence the multi-lockfile warning without touching files
  // outside the repo.
  turbopack: { root: __dirname },
  devIndicators: false,
  async redirects() {
    return [
      // Retirement 301s (playbook 2.5): API/developers, CDI, and the
      // newsletter are dead surfaces — everything goes home. The route folders
      // were deleted in Phase 8; these redirects keep old links honest.
      { source: "/developers", destination: "/", permanent: true },
      { source: "/cdi", destination: "/", permanent: true },
      { source: "/newsletter", destination: "/", permanent: true },
      // Phase 8: the standalone Alpha page retired — the public track record
      // lives on the Dashboard (Picks). The engine behind it stays.
      { source: "/alpha", destination: "/dashboard", permanent: true },
      // Phase 8: legacy v1 Research sub-pages — their jobs moved into the
      // Research Skills sheet and the Portfolio surface.
      { source: "/research/allocator", destination: "/research", permanent: true },
      { source: "/research/portfolio", destination: "/portfolio", permanent: true },
      // The CDI page once lived on the literal /index route (it collides with
      // the root segment under Next 16.2/Turbopack). With /cdi itself retired,
      // send the old path straight home — no redirect chain.
      { source: "/index", destination: "/", permanent: true },
      // Phase 5: the standalone Watchlist merged into Portfolio's Watching tab.
      { source: "/watchlist", destination: "/portfolio?tab=watching", permanent: true },
    ];
  },
};

export default nextConfig;
