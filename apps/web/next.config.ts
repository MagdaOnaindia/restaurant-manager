import path from "path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Next consume @rms/shared desde su código fuente TS (react-refresh no soporta
// bien el dist CJS enlazado por pnpm fuera de node_modules). La API (NestJS)
// sigue usando el dist compilado.
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
