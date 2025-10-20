import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the base URL for the application
 * Works on both server and client side
 *
 * Uses VERCEL_PROJECT_PRODUCTION_URL which is specifically designed for
 * generating OG-image URLs and other production links.
 * See: https://vercel.com/docs/environment-variables/system-environment-variables#vercel-project-production-url
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (explicit override for custom scenarios)
 * 2. VERCEL_PROJECT_PRODUCTION_URL (Vercel's recommended var for OG images - always production domain)
 * 3. NEXT_PUBLIC_VERCEL_URL (current deployment URL for dev/preview)
 * 4. window.location.origin (client-side fallback)
 * 5. http://localhost:3000 (local development)
 */
export function getBaseUrl(): string {
  // 1. Explicit override (if needed for special cases)
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  // 2. Vercel production domain (recommended for OG images)
  // Always points to production domain even in preview deployments
  if (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. Current Vercel deployment URL (works for preview deployments)
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  // 4. Client-side fallback (browser only)
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 5. Local development fallback
  return "http://localhost:3000";
}
