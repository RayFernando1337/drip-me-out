<!-- b79ccd0c-d77c-4221-9cc0-aee53cfdd866 930cd81c-c39b-4190-98f8-cd97a00db5d3 -->
# Image Pipeline Audit & Optimization Plan

## Critical Regression Identified

**Problem:** Gallery only shows `isGenerated === true` images, so users see NOTHING during the 10-15 second AI processing time. This breaks the optimistic UI pattern and Convex real-time updates.

**Current broken flow:**

1. User uploads → Original stored with metadata
2. Gallery query filters out originals (only shows `isGenerated === true`)
3. User sees blank/no feedback for 10-15 seconds ⚠️
4. Generated image appears when complete

**Expected flow:**

1. User uploads → Original appears IMMEDIATELY with blur placeholder
2. Processing overlay shows on original image (via `generationStatus`)
3. When complete → Generated image appears alongside or replaces original
4. All updates via Convex reactivity (no manual polling)

---

## Architecture Diagram

### Current Image Upload → Display Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│ CLIENT (Browser)                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User selects image (HEIC/JPEG/PNG/WebP)                        │
│      ↓                                                               │
│  2. lib/imagePrep.ts:                                               │
│     • HEIC → WebP (if needed)                                       │
│     • Compress if >1MB (skip if <1MB) ⚡ NEW                        │
│     • Extract width/height via createImageBitmap                    │
│     • Generate 32px blur placeholder                                │
│      ↓                                                               │
│  3. Upload to Convex Storage                                        │
│     • POST to uploadUrl with WebP blob                              │
│     • Typically 200KB - 3MB                                         │
│      ↓                                                               │
│  4. Call uploadAndScheduleGeneration mutation                       │
│     • Pass storageId + metadata                                     │
│                                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│ CONVEX BACKEND                                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  5. uploadAndScheduleGeneration (mutation):                         │
│     • Validate storage blob exists                                  │
│     • Check user has credits                                        │
│     • Deduct 1 credit                                               │
│     • Insert image record:                                          │
│       - body: storageId                                             │
│       - userId, contentType                                         │
│       - originalWidth/Height                                        │
│       - placeholderBlurDataUrl                                      │
│       - generationStatus: "pending"                                 │
│     • Schedule: ctx.scheduler.runAfter(0, generateImage)           │
│      ↓                                                               │
│  6. generateImage (internalAction - Node runtime):                  │
│     • Update status → "processing"                                  │
│     • Fetch original from Convex Storage                            │
│     • Convert to base64                                             │
│     • Call Google Gemini 2.5 Flash API                              │
│     • Receive AI-generated base64 (~1.5MB)                          │
│     • Convert to Blob, store in Convex ⚡ SIMPLIFIED                │
│     • Create generated image record (isGenerated: true)             │
│     • Update original status → "completed"                          │
│                                                                      │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│ CLIENT (Real-time Updates via useQuery)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  7. Gallery reactivity (❌ REGRESSION):                             │
│     • useQuery(api.images.getGalleryImagesPaginated)               │
│     • Current filter: ONLY isGenerated === true                     │
│     • Missing: pending/processing originals                         │
│      ↓                                                               │
│  8. User sees NOTHING during processing ⚠️                          │
│      ↓                                                               │
│  9. Generated image appears when complete                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ VERCEL EDGE (Image Optimization)                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  • Next.js Image component requests                                 │
│  • Cache HIT → Serve from edge (8KB read units)                     │
│  • Cache MISS → Transform + cache (transformation + write units)    │
│  • Config: 31-day TTL, WebP only ⚡ OPTIMIZED                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Identified Issues

### 1. Gallery Reactivity Regression (CRITICAL)

**File:** `convex/images.ts` - `getGalleryImagesPaginated`

**Current code:**

```typescript
// Only shows generated images
for (const img of result.page) {
  if (img.isGenerated === true) {
    galleryImages.push(img);
  }
}
```

**Problem:** No visual feedback during 10-15 second processing time.

**Solution:** Show originals with processing state, then transition to showing generated result:

```typescript
for (const img of result.page) {
  if (img.isGenerated === true) {
    galleryImages.push(img);  // Always show generated
  } else if (img.generationStatus === "pending" || 
             img.generationStatus === "processing") {
    galleryImages.push(img);  // Show processing originals
  }
  // Don't show completed originals (only show their generated results)
}
```

### 2. Missing Optimistic Placeholder Pattern

**File:** `components/ImagePreview.tsx`

**Current:** Uses `placeholderBlurDataUrl` from database, but doesn't show uploaded image during processing.

**Best Practice (Lee Robinson technique):**

- Show blur placeholder immediately on upload
- Optimistic UI - render before Convex confirms
- Smooth transition to processed result

**Solution:** Add optimistic image state during upload:

```typescript
// In app/page.tsx after successful upload
const [optimisticImages, setOptimisticImages] = useState([]);

// After uploadAndScheduleGeneration succeeds:
setOptimisticImages(prev => [{
  _id: 'optimistic-' + Date.now(), // Temporary ID
  url: URL.createObjectURL(preparedFile),  // Local preview
  generationStatus: 'pending',
  placeholderBlurDataUrl,
  // ... metadata
}, ...prev]);

// Clear when real image appears from Convex
```

### 3. Image Component Not Using Priority Correctly

**Files:** Multiple components

**Current:** Not using `priority` prop on above-fold images.

**Impact:** Slower LCP (Largest Contentful Paint).

**Solution:** Add `priority` to first 8 gallery images:

```typescript
<Image
  priority={index < 8}  // First two rows only
  // ... other props
/>
```

### 4. Missing Loading Skeleton During Initial Query

**File:** `components/ImagePreview.tsx`

**Current:** Shows "Upload your first image" when `images === undefined` OR `images.length === 0`.

**Problem:** Can't distinguish between loading and actually empty.

**Solution:**

```typescript
if (images === undefined) {
  return <GallerySkeleton />;  // Loading state
}
if (images.length === 0) {
  return <EmptyState />;  // Actually empty
}
```

### 5. Not Leveraging Next.js 15 `loading` Prop

**Research finding:** Next.js Image supports `loading="eager"` for critical images.

**Solution:** Use on hero images and first two gallery rows.

---

## Convex Best Practices Review

### Current Compliance ✅

- ✅ Using proper validators with `args` and `returns`
- ✅ Using `useQuery` for reactivity (not manual polling)
- ✅ Type inference from query return types
- ✅ Proper index usage (`by_userId_and_createdAt`)
- ✅ Using `useMemo` to stabilize query results

### Issues Found ⚠️

1. **Query overfetches then filters** - Line 506-515 in `images.ts`:
   ```typescript
   const adjustedPaginationOpts = {
     ...args.paginationOpts,
     numItems: Math.ceil(args.paginationOpts.numItems * 1.5),  // ⚠️ Overfetch
   };
   ```


**Better:** Use separate queries or a compound index for `by_userId_and_isGenerated_and_createdAt`.

2. **Missing loading states in queries** - Should return structured loading info.

3. **Gallery filter logic duplicated** - Should be in helper function.

---

## Next.js 15 Image Optimizations to Implement

### From Research & Lee Robinson Best Practices:

1. **Use `placeholder="blur"` with `blurDataURL`** ✅ (Already doing)

2. **Set `priority` on above-fold images** ❌ (Missing)
   ```typescript
   <Image priority={index < 8} ... />
   ```

3. **Optimize `sizes` prop for actual rendered sizes** ⚠️ (Can improve)
   ```typescript
   // Current
   sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
   
   // Better - match actual grid
   sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33.33vw, 25vw"
   ```

4. **Use `loading="eager"` for first row** ❌ (Missing)

5. **Add `decoding="async"` for below-fold** ❌ (Missing)

6. **Implement fade-in animation on load** ❌ (Missing)
   ```typescript
   const [loaded, setLoaded] = useState(false);
   <Image
     onLoad={() => setLoaded(true)}
     className={loaded ? 'opacity-100' : 'opacity-0'}
   />
   ```

7. **Use `quality` prop strategically** ❌ (Missing)

   - Gallery thumbnails: `quality={75}`
   - Modal full-size: `quality={90}`

---

## Implementation Plan

### Phase 1: Fix Critical Regression (Reactivity)

**Files:** `convex/images.ts`

1. Update `getGalleryImagesPaginated` to show processing originals:
   ```typescript
   for (const img of result.page) {
     if (img.isGenerated === true) {
       galleryImages.push(img);
     } else if (img.generationStatus === "pending" || 
                img.generationStatus === "processing") {
       galleryImages.push(img);  // ⚡ Show during processing
     }
   }
   ```

2. Add `getGalleryImagesCount` to count correctly:

   - Include processing originals
   - Include generated images

### Phase 2: Implement Optimistic UI Pattern

**Files:** `app/page.tsx`, `components/ImagePreview.tsx`

1. Add optimistic image state in upload flow
2. Merge optimistic + real images in display
3. Remove optimistic when real image appears (via ID matching)
4. Use `URL.createObjectURL()` for instant preview

### Phase 3: Next.js Image Optimizations

**Files:** `components/ImagePreview.tsx`, `components/ImageModal.tsx`, `components/PublicGallery.tsx`

1. Add `priority` to first 8 images
2. Add `loading="eager"` to first row, `loading="lazy"` to rest
3. Implement fade-in animation with `onLoad` callback
4. Use `quality={75}` for thumbnails, `quality={90}` for modals
5. Optimize `sizes` prop to match actual grid breakpoints
6. Add skeleton loading states

### Phase 4: Performance Optimizations

**Files:** `convex/images.ts`, `lib/imagePrep.ts`

1. Create compound index: `by_userId_and_isGenerated_and_createdAt`
2. Reduce overfetch multiplier (1.5x → 1.2x)
3. Add query result caching hint
4. Optimize blur placeholder generation (already fast at <1MB)

### Phase 5: Code Review Fixes

**Apply Convex best practices:**

1. Extract filter logic to helper function
2. Add proper loading state differentiation
3. Ensure all mutations use proper validators
4. Add query performance monitoring

---

## Detailed Changes

### Fix 1: Gallery Query (CRITICAL - Restore Reactivity)

```typescript
// convex/images.ts - getGalleryImagesPaginated
for (const img of result.page) {
  // Always show generated images
  if (img.isGenerated === true) {
    galleryImages.push(img);
    continue;
  }
  
  // Show originals during processing for real-time feedback
  if (img.generationStatus === "pending" || 
      img.generationStatus === "processing") {
    galleryImages.push(img);
  }
  // Hide completed originals (their generated version shows instead)
}
```

### Fix 2: Optimistic UI in Upload

```typescript
// app/page.tsx
const [optimisticUploads, setOptimisticUploads] = useState<Array<{
  tempId: string;
  objectUrl: string;
  blurDataURL?: string;
  width: number;
  height: number;
}>>([]);

// After successful uploadAndScheduleGeneration:
const objectUrl = URL.createObjectURL(preparedFile);
setOptimisticUploads(prev => [{
  tempId: 'temp-' + Date.now(),
  objectUrl,
  blurDataURL: placeholderBlurDataUrl,
  width: originalWidth,
  height: originalHeight,
}, ...prev]);

// Cleanup when real image appears (useEffect watching galleryResult)
```

### Fix 3: Image Component Optimizations

```typescript
// components/ImagePreview.tsx
<ImageWithFallback
  src={image.url}
  width={width}
  height={height}
  priority={index < 8}  // First two rows
  loading={index < 8 ? "eager" : "lazy"}  // Explicit loading
  quality={75}  // Lower for thumbnails
  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33.33vw, 25vw"
  placeholder={image.placeholderBlurDataUrl ? "blur" : "empty"}
  blurDataURL={image.placeholderBlurDataUrl}
  onLoad={() => setLoadedImages(prev => [...prev, image._id])}  // Track loaded
  className={cn(
    "h-full w-full object-cover transition-opacity duration-300",
    loadedImages.includes(image._id) ? "opacity-100" : "opacity-0"
  )}
/>
```

### Fix 4: Loading States

```typescript
// components/ImagePreview.tsx
export default function ImagePreview({ ... }) {
  if (images === undefined) {
    // Show skeleton while query loads
    return <GallerySkeleton count={12} />;
  }
  
  if (images.length === 0 && !hasActiveGenerations) {
    // Actually empty
    return <EmptyGalleryState />;
  }
  
  // Merge optimistic + real images
  const displayImages = [...optimisticImages, ...images];
}

function GallerySkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-square bg-muted animate-pulse rounded-xl" />
      ))}
    </div>
  );
}
```

### Fix 5: Add Compound Index

```typescript
// convex/schema.ts
images: defineTable({
  // ... existing fields
})
  .index("by_userId_and_createdAt", ["userId", "createdAt"])
  .index("by_userId_and_isGenerated_and_createdAt", [
    "userId",
    "isGenerated", 
    "createdAt"
  ])  // ⚡ NEW - Enables efficient filtering
```

---

## Testing Checklist

- [ ] Upload image - should appear IMMEDIATELY in gallery with processing state
- [ ] During processing - should show blur placeholder + spinner overlay
- [ ] After processing - generated image appears, original hidden
- [ ] Verify Convex reactivity - no manual refresh needed
- [ ] Check LCP score - should be <2.5s
- [ ] Verify first 8 images load with priority
- [ ] Test with slow 3G to ensure progressive enhancement
- [ ] Verify no console warnings about image sizing

---

## Monitoring & Metrics

**Before fixes:**

- Upload → Display: ~10-15s with no feedback ❌
- LCP: Unknown (likely >3s)
- Image optimization: Not optimal

**After fixes:**

- Upload → Display: Immediate (<100ms optimistic) ✅
- Processing feedback: Real-time via Convex ✅
- LCP target: <2.5s ✅
- Transformation efficiency: Maximized ✅

---

## Code Review Against Convex Best Practices

### Violations Found:

1. **Overfetching in pagination** (Line 506-509)

   - Uses 1.5x multiplier then filters
   - Better: Use compound index to query exact subset

2. **Filter logic not extracted** (Line 520-529)

   - Duplicated logic across queries
   - Better: Create `shouldShowInGallery(img)` helper

3. **Missing query result structure** 

   - Queries return raw arrays/objects
   - Better: Return `{ data, isLoading, error }` structure

### Compliant Patterns ✅:

- Using `withIndex` not `filter` ✅
- Proper validators on all functions ✅
- Using `useMemo` for stable refs ✅
- Type inference from queries ✅
- Scheduling with `ctx.scheduler` ✅

---

## Files to Modify

1. `convex/images.ts` - Fix gallery query filter logic
2. `convex/schema.ts` - Add compound index
3. `app/page.tsx` - Add optimistic upload state
4. `components/ImagePreview.tsx` - Optimize Image components, add loading states
5. `components/ImageModal.tsx` - Add quality prop, optimize loading
6. `components/PublicGallery.tsx` - Add priority for first row
7. `components/HeroGalleryDemo.tsx` - Add priority to hero images

---

## Success Criteria

- ✅ Image appears in gallery instantly on upload (optimistic)
- ✅ Processing state visible via Convex real-time updates
- ✅ Smooth transition to generated image when complete
- ✅ LCP < 2.5s
- ✅ No unnecessary Vercel transformations
- ✅ Gallery responsive and consistent
- ✅ Follows all Convex best practices
- ✅ No manual polling or refresh logic

### To-dos

- [ ] Delete app/api/encode-webp/route.ts and remove sharp/image-size dependencies from package.json
- [ ] Update convex/generate.ts to store Gemini output directly without re-encoding
- [ ] Add optimal image configuration to next.config.ts (cache TTL, single format, device sizes)
- [ ] Review and update image components to use proper Next.js Image props with dimensions and sizes
- [ ] End-to-end testing: upload, generate, view in gallery and share page
- [ ] Update feature spec and progress docs to reflect simplified architecture and cost savings