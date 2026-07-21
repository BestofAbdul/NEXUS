import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@nexus/agents",
    "@nexus/mcp-adapters",
    "@nexus/mission-engine",
    "@nexus/shared",
  ],
};

export default nextConfig;
