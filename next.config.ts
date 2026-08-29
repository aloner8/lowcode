import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  experimental: {
    // Proxy buffers request bodies before route handlers. Keep this slightly
    // above the 100 MB File Manager limit to leave room for multipart headers.
    proxyClientMaxBodySize: "110mb",
  },
};

export default nextConfig;
