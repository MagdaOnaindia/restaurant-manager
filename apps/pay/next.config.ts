import path from "path";
import type { NextConfig } from "next";

// Ver apps/web/next.config.ts: @rms/shared se consume desde el código fuente TS.
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
