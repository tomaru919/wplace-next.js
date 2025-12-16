import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  allowedDevOrigins: ["mobile-pc.local"],
  devIndicators: false,
}

export default nextConfig
