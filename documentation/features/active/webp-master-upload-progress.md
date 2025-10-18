# WebP Master Upload Pipeline — Progress Tracker

**Last Updated:** 2025-10-18  
**Specification:** [webp-master-upload-spec.md](./webp-master-upload-spec.md)

## Status Snapshot

- **Client prep ✅** — `prepareImageForUpload` now normalizes every upload to WebP with intrinsic metadata and blur placeholders, wiring those fields through `app/page.tsx`.
- **Backend metadata ✅** — `uploadAndScheduleGeneration` persists the captured metadata and validates storage blobs before scheduling generation.
- **Generated asset WebP ✅ (new)** — Gemini outputs are re-encoded to WebP server-side with graceful PNG fallback via `@squoosh/lib`, ensuring consistent masters plus updated width/height/size metadata.
- **UI consumption 🚧** — Upload/gallery entry points consume blur data; modal/share surfaces now render with intrinsic dimensions to reduce unnecessary Vercel variants. Remaining gallery tiles still rely on square crops.

## Recent Updates (2025-10-18)

1. **Server-side WebP transcoding**  
   - Added `@squoosh/lib` and updated `convex/generate.ts` to run WebP encoding inside the generation action, defaulting to PNG only when the encoder fails.  
   - Stored metadata now reflects the encoded buffer so Convex records expose accurate dimensions and byte sizes.

2. **Intrinsic rendering in detail views**  
   - `components/ImageModal.tsx` and `components/PublicImageModal.tsx` switched to the stored `originalWidth`/`originalHeight` and blur placeholders to drive `next/image`, trimming first-hit transformations for zoomed views and share links.

3. **Docs & pricing research**  
   - Verified Vercel’s February 2025 pricing shift (transform/cache based billing) to confirm why shrinking masters and limiting layout variants matters for spend control.

## Open Items

- **Gallery tiles:** Square crops still use `fill`; evaluate adopting aspect-ratio wrappers or responsive `width/height` pipelines to squeeze a few more cache misses out of Vercel.
- **Placeholder coverage:** Generated images reuse client-side placeholders when present; explore creating low-res placeholders during server re-encode to keep parity with uploads.
- **Verification:** After deploying the re-encode, recheck Vercel Observability for both transformation counts and cache write units to quantify savings vs. the previous PNG flow.

## Next Steps

1. Audit hero/gallery components for opportunities to rely on intrinsic sizing while keeping the desired layout.
2. Add blur-placeholder generation to the Convex pipeline so generated derivatives match upload UX.
3. Move the feature docs to `/documentation/features/completed/` once the gallery surfaces are updated and monitoring confirms the target cost reductions.
