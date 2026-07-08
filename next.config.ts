// Brand Brain VI Generator
// deploy: 2026-07-09T07:33:35+08:00 — force Zeabur rebuild for 0707-online-e2e-test-bakery
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep for large SSE streaming responses — triggers deprecation warning but safe to ignore
  serverRuntimeConfig: {
    responseLimit: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;