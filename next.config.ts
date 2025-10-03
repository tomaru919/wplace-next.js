import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb"
    },
    serverComponentsExternalPackages: ["sharp"]
  }
};

export default nextConfig;
