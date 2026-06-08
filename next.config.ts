// Brand Brain VI Generator
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
