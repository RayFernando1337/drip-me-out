import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "**.convex.cloud",
        pathname: "/api/storage/**",
      },
    ],
    formats: ["image/webp"], // Single format to reduce transformations
    minimumCacheTTL: 2678400, // 31 days - reduces cache writes and transformations
    deviceSizes: [640, 750, 828, 1080, 1200], // Match actual usage patterns
    imageSizes: [16, 32, 48, 64, 96, 128, 256], // Thumbnails
  },
};

export default nextConfig;
