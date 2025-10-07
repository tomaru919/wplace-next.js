import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  allowedDevOrigins: ["mobile-pc.local", "192.168.11.7"]
}

export default nextConfig
