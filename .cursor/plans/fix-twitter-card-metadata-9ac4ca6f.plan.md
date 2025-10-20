<!-- 9ac4ca6f-a7fb-421d-9e0b-7e8c1bbeb20b c10c27aa-fa08-4362-be0d-5e3efbd5dd24 -->
# Fix Twitter Card Metadata for Share Links (DRY + Vercel Best Practices)

## Problem

When sharing links to `https://animeleak.com/share/[imageId]` on X/Twitter, the image preview doesn't show. The screenshot shows a "media could not be played" error.

## Root Causes

1. **Missing `metadataBase`**: Next.js 15 requires absolute URLs for Open Graph/Twitter images
2. **Inconsistent URL construction**: Currently `ImageModal.tsx` has inline URL logic that's duplicated
3. **No centralized utility**: Need a DRY approach for base URL across server and client

## Vercel Environment Variables (Verified)

According to [Vercel's official documentation](https://vercel.com/docs/environment-variables/system-environment-variables):

- **`VERCEL_PROJECT_PRODUCTION_URL`**: Production domain (custom domain or vercel.app). **Always set, even in preview deployments. Specifically useful for OG-image URLs.** Does NOT include `https://` protocol.
- **`NEXT_PUBLIC_VERCEL_URL`**: Current deployment URL. Does NOT include `https://` protocol.
- All Vercel URLs require adding `https://` manually

## Solution Overview (Leveraging Vercel Best Practices)

1. Create centralized `getBaseUrl()` utility that uses `VERCEL_PROJECT_PRODUCTION_URL` for consistent production URLs
2. Update `ImageModal.tsx` to use the utility (eliminate duplication)
3. Update share page metadata to use the utility
4. Add `metadataBase` to root layout using the utility

## Implementation Steps

### 1. Create Centralized Base URL Utility

**File**: `lib/utils.ts`

Add the following function leveraging Vercel's recommended approach:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  // 5. Local development fallback
  return 'http://localhost:3000';
}
```

### 2. Add metadataBase to Root Layout

**File**: `app/layout.tsx`

Update the metadata export:

```typescript
import { getBaseUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: "Anime Leak - Where Anime Leaks Into Reality",
  description: "AI-powered anime transformation. Watch everyday objects leak into anime reality with whimsical illustrations and magical effects.",
};
```

### 3. Update Share Page Metadata

**File**: `app/share/[imageId]/page.tsx`

Update the `generateMetadata` function:

```typescript
import { getBaseUrl } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ imageId: string }> }) {
  const { imageId } = await params;

  const image = await fetchQuery(api.images.getImageById, {
    imageId: imageId as Id<"images">,
  });

  if (!image) {
    return {
      title: "Image Not Found - Anime Leak",
      description: "This image is no longer available.",
    };
  }

  const siteUrl = getBaseUrl();
  const pageUrl = `${siteUrl}/share/${imageId}`;
  const imageUrl = image.url; // Convex URLs are already absolute

  return {
    title: "Check Out My Anime Transformation!",
    description: "Watch objects transform as anime leaks into reality. Create yours!",
    openGraph: {
      title: "Check Out My Anime Transformation!",
      description: "Watch objects transform as anime leaks into reality. Create yours!",
      url: pageUrl,
      siteName: "Anime Leak",
      images: [
        {
          url: imageUrl,
          width: image.originalWidth ?? 1200,
          height: image.originalHeight ?? 630,
          alt: "Anime transformation - where anime leaks into reality",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Check Out My Anime Transformation!",
      description: "Watch objects transform as anime leaks into reality.",
      images: [imageUrl],
    },
  };
}
```

### 4. Refactor ImageModal to Use Utility

**File**: `components/ImageModal.tsx`

Update line 141 to use the centralized utility:

```typescript
import { getBaseUrl } from "@/lib/utils";

// Replace line 141:
// OLD: const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/share/${currentImage._id}`;
// NEW:
const shareUrl = `${getBaseUrl()}/share/${currentImage._id}`;
```

Also update line 154 (Twitter share) - it should use the same `shareUrl` variable.

### 5. Enable Vercel System Environment Variables

**In Vercel Project Settings:**

1. Navigate to your project dashboard
2. Go to Settings → Environment Variables
3. Check **"Automatically expose System Environment Variables"**

This enables `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL` and other Vercel variables.

**Optional Custom Override (Vercel Dashboard):**

Only needed if you want to explicitly override (usually not necessary):

```
NEXT_PUBLIC_SITE_URL=https://animeleak.com
```

**For Local Development:**

No `.env.local` needed - defaults to `http://localhost:3000`

### 6. Testing Strategy

After implementation:

1. **Local Development**: Verify URLs use `http://localhost:3000`
2. **Preview Deployment**: Deploy and verify metadata URLs point to production domain (`animeleak.com`)
3. **Production**: Verify metadata URLs use `https://animeleak.com`
4. **Twitter Card Validator**: Test at https://cards-dev.twitter.com/validator
5. **Share on X**: Verify image appears in post preview
6. **Cache Busting**: If needed, append `?v=1` to force Twitter to refresh

## Expected Outcome

- ✅ Share links display anime transformation images in Twitter/X previews
- ✅ DRY code - single source of truth for base URL
- ✅ Works across server/client, dev/preview/production
- ✅ **Always uses production domain for OG images (Vercel best practice)**
- ✅ Proper Twitter Card with large image format
- ✅ No more "media could not be played" errors
- ✅ Consistent URL construction throughout app

## Files Changed

1. `lib/utils.ts` - Add `getBaseUrl()` utility
2. `app/layout.tsx` - Add `metadataBase` using utility
3. `app/share/[imageId]/page.tsx` - Enhanced metadata with utility
4. `components/ImageModal.tsx` - Refactor to use utility (DRY)

## Benefits of This Approach

- **DRY**: Single utility function for all base URL needs
- **Vercel Best Practice**: Uses `VERCEL_PROJECT_PRODUCTION_URL` as recommended for OG images
- **Type-safe**: TypeScript ensures consistent usage
- **Flexible**: Works on server (SSR, metadata) and client (share buttons)
- **Environment-aware**: Automatically handles dev/preview/production
- **Future-proof**: Easy to update URL logic in one place
- **Preview-friendly**: Preview deployments show production domain in shared links (correct behavior for social sharing)

## Reference

- [Vercel System Environment Variables](https://vercel.com/docs/environment-variables/system-environment-variables#vercel-project-production-url)
- [Next.js 15 Metadata Documentation](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)

### To-dos

- [ ] Create getBaseUrl() utility function in lib/utils.ts using VERCEL_PROJECT_PRODUCTION_URL
- [ ] Add metadataBase to root layout using getBaseUrl()
- [ ] Update share page generateMetadata with complete Twitter Card fields using getBaseUrl()
- [ ] Refactor ImageModal.tsx to use getBaseUrl() utility (eliminate duplication)
- [ ] Enable 'Automatically expose System Environment Variables' in Vercel project settings
- [ ] Test in local, preview, and production environments with Twitter Card Validator