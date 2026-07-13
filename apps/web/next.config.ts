import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next consumes @rms/shared from its TS source (react-refresh doesn't handle
// the pnpm-linked CJS dist outside node_modules well). The API (NestJS)
// still uses the compiled dist.
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

export default withNextIntl(nextConfig);
