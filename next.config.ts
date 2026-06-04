import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
