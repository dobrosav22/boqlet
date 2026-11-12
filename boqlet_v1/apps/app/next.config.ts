import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@ifc-boq/api"],
};

export default nextConfig;
