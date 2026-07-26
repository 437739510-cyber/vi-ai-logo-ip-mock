// Brand Brain VI Generator
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for EdgeOne Pages serverless compatibility
  output: "standalone",
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