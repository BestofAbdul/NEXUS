import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nexus/mission-engine", "@nexus/shared"],
};

export default nextConfig;
