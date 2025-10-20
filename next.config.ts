import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Remove console logs in production, but keep error logs
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error"],
          }
        : false,
  },
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
    // Qualities config: Next.js 16 will require this. For now, omit to allow all qualities.
    // See: https://nextjs.org/docs/messages/next-image-unconfigured-qualities
    // We'll add this when upgrading to Next.js 16:
    // qualities: [50, 70, 75, 85, 90, 100]
  },
};

export default nextConfig;
