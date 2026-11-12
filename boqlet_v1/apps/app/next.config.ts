import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Where `/api/v1` goes outside production: the mock API (phase 1) or the Java backend (phase 3).
 * In production the ingress routes `/api/v1` to the API on the same domain (architecture.md).
 */
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4010";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@ifc-boq/api"],
  async rewrites() {
    if (process.env.NODE_ENV === "production" && !process.env.API_PROXY_TARGET) return [];
    return [
      { source: "/api/v1/:path*", destination: `${apiTarget}/api/v1/:path*` },
      // The mock's dev endpoints (seeded users for the mock sign-in page); never in production.
      { source: "/_dev/:path*", destination: `${apiTarget}/_dev/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
