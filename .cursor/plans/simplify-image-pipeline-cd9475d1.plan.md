<!-- cd9475d1-1ca3-44ff-9b65-a06f1e9f1638 a4422f7b-2623-4cd9-8264-d796bd5e430f -->
# Simplify Image Pipeline for Cost Optimization

## Context

Based on cost analysis, the current pipeline over-engineers image processing for the current scale (0-10K users). The `/api/encode-webp` route adds unnecessary complexity and costs without benefit. Vercel Image Optimization can handle transformations more efficiently at this scale.

## Changes Overview

1. **Remove** server-side re-compression via `/api/encode-webp`
2. **Simplify** Convex generate action to store Gemini output directly
3. **Configure** Next.js Image Optimization for optimal caching
4. **Keep** client-side WebP compression (cost-effective)
5. **Update** documentation to reflect simplified architecture

## Implementation Steps

### 1. Remove Server-Side Encoding Route

**File:** `app/api/encode-webp/route.ts`

- Delete this entire file
- Remove `sharp` dependency from package.json
- Remove `image-size` dependency if no longer used elsewhere

### 2. Simplify Convex Generate Action

**File:** `convex/generate.ts`

Current flow:

```typescript
Gemini output → POST to /api/encode-webp → Get WebP + metadata → Store in Convex
```

New flow:

```typescript
Gemini output (base64) → Convert to Blob → Store directly in Convex
```

**Changes needed:**

- Remove the POST request to `/api/encode-webp`
- Remove `IMAGE_ENCODER_ENDPOINT` environment variable usage
- Store Gemini's base64 output directly after converting to Blob
- Generate blur placeholder from the base64 data if needed (or skip and let Next.js generate)
- Extract width/height using a lightweight approach (or defer to Vercel)

**Key insight:** Gemini already returns optimized images (~1.5MB). No need to re-compress.

### 3. Configure Next.js Image Optimization

**File:** `next.config.ts`

Add/update image configuration:

```typescript
images: {
  minimumCacheTTL: 2678400, // 31 days (reduces transformations)
  formats: ['image/webp'],  // Single format (don't generate AVIF too)
  deviceSizes: [640, 750, 828, 1080, 1200], // Match actual usage
  imageSizes: [16, 32, 48, 64, 96, 128, 256], // Thumbnails
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '*.convex.cloud',
      pathname: '/api/storage/**',
    },
  ],
}
```

### 4. Update Image Components

**Files to review:**

- `components/ImageModal.tsx`
- `components/PublicImageModal.tsx`
- `components/PublicGallery.tsx`
- `components/HeroGalleryDemo.tsx`
- `app/share/[imageId]/client.tsx`

**Ensure all use proper Next.js Image props:**

```typescript
<Image
  src={url}
  width={originalWidth}
  height={originalHeight}
  sizes="(max-width: 640px) 100vw, 640px"
  placeholder={blurDataURL ? "blur" : "empty"}
  blurDataURL={blurDataURL}
  alt={alt}
/>
```

### 5. Update Schema (If Needed)

**File:** `convex/schema.ts`

Verify the images table has:

- `contentType` (should be from upload, not re-encoding)
- `originalWidth` / `originalHeight` (from client prep)
- `placeholderBlurDataUrl` (from client prep)

For generated images, these can be optional or extracted client-side after load.

### 6. Clean Up Client Prep

**File:** `lib/imagePrep.ts`

**Keep as-is** — Client-side compression is good and cost-effective:

- HEIC → WebP conversion ✅
- Compress to ≤3MB, ≤1600px ✅
- Extract dimensions ✅
- Generate blur placeholder ✅

### 7. Remove Dependencies

**File:** `package.json`

Remove if not used elsewhere:

- `sharp` (only used in encode-webp route)
- `image-size` (check if used in generate.ts)

### 8. Update Documentation

**Files:**

- `documentation/features/active/webp-master-upload-spec.md`
- `documentation/features/active/webp-master-upload-progress.md`

Update to reflect:

- Removed server-side encoding step
- Direct Gemini → Convex storage flow
- Reliance on Vercel Image Optimization
- Cost savings at current scale

Add note about when to revisit (50GB+ Convex bandwidth/month).

### 9. Environment Cleanup

Remove from environment variables:

- `IMAGE_ENCODER_ENDPOINT` (if added)

## Testing Checklist

- [ ] Upload new image (HEIC, JPEG, PNG)
- [ ] Verify AI generation completes successfully
- [ ] Check generated image displays correctly in gallery
- [ ] Verify share page works with proper image optimization
- [ ] Test blur placeholders render
- [ ] Monitor Vercel Observability dashboard for transformation counts
- [ ] Verify no console errors related to images
- [ ] Check Convex logs for any storage/generation errors

## Monitoring Post-Deploy

Track these metrics monthly:

- Convex file bandwidth (alert if > 50GB/month)
- Vercel image transformations (should be low due to caching)
- Vercel Fast Data Transfer (should be under 1TB free tier)
- Image load performance (LCP should be unchanged or better)

## Rollback Plan

If issues arise:

1. Keep simplified generate.ts but add back basic metadata extraction
2. Re-add sharp only if absolutely necessary for dimension extraction
3. Original code is in git history on feature/imagePipeline branch

## Success Metrics

- **Code reduction:** ~100 lines removed
- **Dependencies:** 1-2 packages removed
- **Monthly cost at 1K users:** ~$10 (vs ~$15 current)
- **Complexity:** Simplified flow with fewer moving parts
- **Performance:** Same or better (Vercel edge caching)

## Future Optimization Trigger

**When to revisit:**

- Convex file bandwidth exceeds 100GB/month
- OR 10,000+ active monthly users
- OR transformations exceed 50K/month

**Next evolution:**

- Migrate to Cloudflare R2 + Convex component
- OR BunnyCDN for delivery
- Keep database/reactivity in Convex

### To-dos

- [ ] Delete app/api/encode-webp/route.ts and remove sharp/image-size dependencies from package.json
- [ ] Update convex/generate.ts to store Gemini output directly without re-encoding
- [ ] Add optimal image configuration to next.config.ts (cache TTL, single format, device sizes)
- [ ] Review and update image components to use proper Next.js Image props with dimensions and sizes
- [ ] End-to-end testing: upload, generate, view in gallery and share page
- [ ] Update feature spec and progress docs to reflect simplified architecture and cost savings