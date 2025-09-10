# Unauthenticated Public Gallery

Status: Complete (Finalized September 10, 2025)

This feature showcases featured transformations to unauthenticated users on the landing page, driving inspiration and conversions.

## What Shipped

- Public gallery component `components/PublicGallery.tsx` with grid and load-more
- Backend query `convex/images.getPublicGallery` using compound index and pagination
- Featured toggle in `components/ImageModal.tsx` wired to `api.images.updateFeaturedStatus`
- Admin moderation in `convex/admin.ts` with enable/disable and paginated list
- Schema fields and indexes added in `convex/schema.ts`
- Landing page integration in `app/page.tsx`

## DRY Reuse Highlights

- URL mapping via `convex/lib/images.mapImagesToUrls`
- Validators via `convex/lib/validators` (`GalleryItemValidator`, `PaginatedGalleryValidator`)
- Pagination options reuse (`paginationOptsValidator`)
- Grid and load-more UX matches `components/ImagePreview.tsx`

## Decisions

- Ordering: strictly by `featuredAt` desc via compound index
- No rate limiting for public query (deferred)
- Admin moderation in scope and shipped

## Files

- `components/PublicGallery.tsx`
- `convex/images.ts` (getPublicGallery, updateFeaturedStatus)
- `convex/admin.ts`
- `convex/schema.ts`
- `components/ImageModal.tsx`
- `app/page.tsx`

## Verification

- `bunx convex dev` shows functions registered without errors
- `bun run build` passes TS checks
- Landing page renders gallery and paginates correctly
