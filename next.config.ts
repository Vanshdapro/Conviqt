import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      // Phase 6 retirement 301s (playbook 2.5): API/developers, CDI, and the
      // newsletter are dead surfaces — everything goes home. The route folders
      // themselves are deleted in Phase 8; these redirects fire first either way.
      { source: "/developers", destination: "/", permanent: true },
      { source: "/cdi", destination: "/", permanent: true },
      { source: "/newsletter", destination: "/", permanent: true },
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
