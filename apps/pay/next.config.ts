import path from "path";
import type { NextConfig } from "next";

// See apps/web/next.config.ts: @rms/shared is consumed from its TS source.
const nextConfig: NextConfig = {
  transpilePackages: ["@rms/shared"],
  webpack: (config) => {
    config.resolve.alias["@rms/shared"] = path.resolve(
      __dirname,
      "../../packages/shared/src/index.ts",
    );
    return config;
  },
};

export default nextConfig;
