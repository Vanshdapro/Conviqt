import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The CDI page moved off the literal /index route to /cdi (a route folder named
  // `index` collides with the root segment under Next 16.2/Turbopack and crashes
  // Vercel's onBuildComplete). 301 the old path so citations/inbound links resolve.
  async redirects() {
    return [
      { source: "/index", destination: "/cdi", permanent: true },
      // Phase 5: the standalone Watchlist merged into Portfolio's Watching tab.
      { source: "/watchlist", destination: "/portfolio?tab=watching", permanent: true },
    ];
  },
};

export default nextConfig;
