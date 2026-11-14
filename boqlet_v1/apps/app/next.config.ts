import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Where `/api/v1` goes outside production: the mock API (phase 1) or the Java backend (phase 3).
 * In production the ingress routes `/api/v1` to the API on the same domain (architecture.md).
 */
const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:4010";

/**
 * Module build flags (P36): `MODULE_PRICING=1` builds the app with the pricing module, registered in
 * `src/modules.ts`. The module is for a later phase (P48), so the flag can't be set yet.
 */
const MODULE_PRICING = process.env.MODULE_PRICING ?? "";
if (MODULE_PRICING === "1") throw new Error("MODULE_PRICING=1: the pricing module (packages/pricing-ui, FE-P1) is not built yet (P48).");
/** First URL segments of the modules' areas in this build (`area.routes`): `/{area}/…` is served by `/areas/{area}/…`. */
const MODULE_AREAS: string[] = [];

const nextConfig: NextConfig = {
  output: "standalone",
  env: { MODULE_PRICING },
  transpilePackages: ["@ifc-boq/api"],
  // Share links (F18 "Security"): never indexed, never leak the token through the referrer.
  async headers() {
    return [
      {
        source: "/s/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  async rewrites() {
    // Before the file system, so an area wins over the `[org]` segment (org slugs never take it).
    const beforeFiles = MODULE_AREAS.flatMap((a) => [
      { source: `/${a}`, destination: `/areas/${a}` },
      { source: `/${a}/:path*`, destination: `/areas/${a}/:path*` },
    ]);
    if (process.env.NODE_ENV === "production" && !process.env.API_PROXY_TARGET) return { beforeFiles, afterFiles: [], fallback: [] };
    const afterFiles = [
      { source: "/api/v1/:path*", destination: `${apiTarget}/api/v1/:path*` },
      // The mock's dev endpoints (seeded users for the mock sign-in page); never in production.
      { source: "/_dev/:path*", destination: `${apiTarget}/_dev/:path*` },
    ];
    return { beforeFiles, afterFiles, fallback: [] };
  },
};

export default withNextIntl(nextConfig);
