import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@xenova/transformers'],
  output: "standalone",
  turbopack: {},
};

export default nextConfig;
