import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "**" },
    ],
    unoptimized: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: false,
  // Fix warning about Next.js inferring workspace root when multiple lockfiles exist
  // Point tracing root to the workspace root (one level up from frontend)
  outputFileTracingRoot: path.resolve(__dirname, '..'),
};

export default nextConfig;
