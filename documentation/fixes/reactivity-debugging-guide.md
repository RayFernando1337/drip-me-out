# Reactivity Debugging Guide

**Date:** 2025-10-19  
**Issue:** Gallery not updating after generation completes

## Problem Identified

The frontend was showing a processing spinner even after the backend confirmed successful generation. This indicates a **React state synchronization issue** with Convex reactivity.

## Root Cause Analysis

### Backend Status ✅ WORKING

- Generation completed successfully (Convex logs confirm)
- Original image updated to `generationStatus: "completed"`
- Generated image created with `isGenerated: true`
- Both images have valid URLs

### Frontend Status ❌ BROKEN

- React state showing stale data
- `useMemo` wrappers preventing reactive updates
- Gallery query result not triggering re-renders

## Fixes Applied

### 1. Removed Unnecessary useMemo Wrappers

**Problem:**

```typescript
// Before - prevented reactivity
const galleryResultData = useQuery(api.images.getGalleryImagesPaginated, { paginationOpts });
const galleryResult = useMemo(() => galleryResultData, [galleryResultData]); // ❌ Redundant!
```

This `useMemo` is redundant and can interfere with Convex's reactivity because it adds an extra layer of memoization that might not update correctly.

**Fix:**

```typescript
// After - direct query result
const galleryResult = useQuery(api.images.getGalleryImagesPaginated, { paginationOpts });
```

**Applied to:**

- `galleryResult`
- `totalImagesCount`
- `failedImages`
- `hasActiveGenerations`
- `userCredits`

### 2. Added Debug Logging

**Backend (`convex/images.ts`):**

```typescript
console.log("[Gallery Query] Including generated image:", img._id);
console.log("[Gallery Query] Including processing original:", img._id, "status:", status);
console.log("[Gallery Query] Hiding completed original:", img._id);
console.log("[Gallery Query] Returning", trimmedGalleryImages.length, "images after filtering");
```

**Frontend (`app/page.tsx`):**

```typescript
console.log("[Gallery Update] Query returned", galleryResult.page.length, "images");
console.log("[Gallery Update] Image IDs:", galleryResult.page.map(...));
console.log("[Gallery Update] Replacing with", galleryResult.page.length, "images (first page)");
```

## How to Debug

### Step 1: Check Browser Console

Open DevTools Console and look for these logs:

**Expected flow when generation completes:**

```
[Gallery Update] Query returned 1 images
[Gallery Update] Image IDs: [{id: "j579a...", isGenerated: true, status: undefined}]
[Gallery Update] Replacing with 1 images (first page)
```

### Step 2: Check Convex Dev Logs

Look for these logs in `bunx convex dev`:

**Expected when query runs:**

```
[Gallery Query] Hiding completed original: j57egqj8vhwf224r3n9ax7q5hs7srtz9
[Gallery Query] Including generated image: j579a0d9m65b2jz99c4qewchtx7ssffn
[Gallery Query] Returning 1 images after filtering
```

### Step 3: Force Refresh Test

**If still stuck:**

1. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)
2. Check if generated image appears
3. If YES → React state issue
4. If NO → Query issue

### Step 4: Manual Query Test

Run this in terminal to verify query works:

```bash
bunx convex run images:getGalleryImages
```

Should show the generated image with `isGenerated: true`.

## What Should Happen (Correct Flow)

### Upload Phase

1. User uploads → `uploadAndScheduleGeneration` creates original with `generationStatus: "pending"`
2. Query returns original image with processing state
3. Frontend shows original with spinner overlay ✅

### Processing Phase

1. Backend updates status → `"processing"`
2. Convex reactivity triggers query re-run
3. Frontend useEffect updates state
4. Spinner continues showing ✅

### Completion Phase

1. Backend creates generated image (`isGenerated: true`)
2. Backend updates original → `generationStatus: "completed"`
3. Convex reactivity triggers query re-run
4. Query filters out completed original, returns generated image
5. Frontend useEffect updates state with new images
6. Generated image appears, original disappears ✅

## Likely Issue

**React State Not Updating:**
The `useMemo` wrappers were creating unnecessary memoization layers that prevented Convex's reactive updates from triggering re-renders.

**Solution:**
Removed all `useMemo` wrappers and use query results directly.

## Testing Instructions

### Test 1: Fresh Upload

1. Upload a new image
2. Watch browser console for "[Gallery Update]" logs
3. Watch Convex logs for "[Gallery Query]" logs
4. Verify original appears instantly with spinner
5. Verify generated image appears after ~12 seconds

### Test 2: Page Refresh

1. Refresh the page
2. Gallery should show only generated images
3. No processing spinners should be visible
4. Check console for query logs

### Test 3: Multiple Uploads

1. Upload 3 images in quick succession
2. All should appear with spinners
3. As each completes, spinner should disappear
4. All should transition smoothly

## If Still Broken

### Checklist:

- [ ] Check Convex dev is running (`bunx convex dev`)
- [ ] Verify no TypeScript errors in terminal
- [ ] Check browser console for errors
- [ ] Verify user is authenticated (Clerk)
- [ ] Check network tab for query requests
- [ ] Verify `paginationOpts` state is correct

### Nuclear Option:

```typescript
// Add manual refresh button in app/page.tsx
<Button onClick={() => setPaginationOpts({ numItems: 12, cursor: null })}>
  Force Refresh Gallery
</Button>
```

## Success Criteria

- ✅ Original appears instantly on upload
- ✅ Processing spinner shows in real-time
- ✅ Generated image appears automatically when complete
- ✅ Original disappears when generation finishes
- ✅ No manual refresh needed
- ✅ Console logs show proper query updates

## Files Changed

1. `app/page.tsx` - Removed useMemo wrappers, added debug logging
2. `convex/images.ts` - Added debug logging to query

## Related Docs

- Reactivity audit: `/documentation/fixes/reactivity-and-performance-audit.md`
- Convex reactivity: https://docs.convex.dev/client/react#reactivity
