import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  allowedDevOrigins: ["laptop-p1fo888u.local", "desktop-5egjmva.local"],
  devIndicators: false,
}

export default nextConfig
