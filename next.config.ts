import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  devIndicators: { position: "bottom-right" },
  partialPrefetching: true,
  // Database drivers stay as plain Node requires instead of being bundled.
  serverExternalPackages: ["mongoose", "mongodb", "mongodb-memory-server", "firebase-admin"],
  // The local embedded MongoDB's data folder and service-account keys must never end up in a server bundle.
  outputFileTracingExcludes: { "*": [".data/**", ".secrets/**"] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
