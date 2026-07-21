import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const monorepoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const nextConfig: NextConfig = {
  // Windows blocks the symlinks used by standalone tracing in some OneDrive
  // workspaces. Production builds run on Linux and still emit standalone output.
  output: process.platform === "win32" ? undefined : "standalone",
  outputFileTracingRoot: monorepoRoot,
  transpilePackages: [
    "@nexus/agents",
    "@nexus/mcp-adapters",
    "@nexus/mission-engine",
    "@nexus/shared",
  ],
};

export default nextConfig;
