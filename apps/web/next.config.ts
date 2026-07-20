import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@nexus/agents",
    "@nexus/mcp-adapters",
    "@nexus/mission-engine",
    "@nexus/shared",
  ],
};

export default nextConfig;
