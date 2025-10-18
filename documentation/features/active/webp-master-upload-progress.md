# WebP Master Upload Pipeline — Progress Tracker

**Last Updated:** 2025-10-19  
**Specification:** [webp-master-upload-spec.md](./webp-master-upload-spec.md)

## Status Snapshot

- **Client prep ✅** — `prepareImageForUpload` now normalizes every upload to WebP with intrinsic metadata and blur placeholders, wiring those fields through `app/page.tsx`.
- **Backend metadata ✅** — `uploadAndScheduleGeneration` persists the captured metadata and validates storage blobs before scheduling generation.
- **Generated asset WebP ✅ (new)** — Gemini outputs now round-trip through a Next.js API route backed by `sharp`, preserving the WebP-first pipeline and capturing width/height/size metadata + blur placeholders without relying on Convex-side WASM.
- **UI consumption 🚧** — Upload/gallery entry points consume blur data; modal/share surfaces now render with intrinsic dimensions to reduce unnecessary Vercel variants. Remaining gallery tiles still rely on square crops.

## Recent Updates (2025-10-18)

1. **Server-side WebP transcoding**  
   - Replaced the Convex action’s in-process Squoosh attempt with a call to `/api/encode-webp`, a Node runtime route that uses `sharp` for WebP encoding (with PNG fallback) and returns width, height, size, plus a tiny blur preview.  
   - Added the `IMAGE_ENCODER_ENDPOINT` escape hatch so Convex can locate the route in production while defaulting to `<NEXT_PUBLIC_SITE_URL>/api/encode-webp`.

2. **Intrinsic rendering in detail views**  
   - `components/ImageModal.tsx` and `components/PublicImageModal.tsx` switched to the stored `originalWidth`/`originalHeight` and blur placeholders to drive `next/image`, trimming first-hit transformations for zoomed views and share links.

3. **Docs & pricing research**  
   - Verified Vercel’s February 2025 pricing shift (transform/cache based billing) to confirm why shrinking masters and limiting layout variants matters for spend control.
4. **Convex action investigation**  
   - Dropped the WASM shim entirely—Convex now just posts raw Gemini output to the Vercel route and receives optimized bytes back, unblocking deployment.

## Open Items

- **Gallery tiles:** Square crops still use `fill`; evaluate adopting aspect-ratio wrappers or responsive `width/height` pipelines to squeeze a few more cache misses out of Vercel.
- **Placeholder coverage:** Generated images now receive a server-generated blur placeholder from the encoder route; confirm that downstream components display it everywhere (modal/gallery/share).
- **Verification:** After deploying the re-encode, recheck Vercel Observability for both transformation counts and cache write units to quantify savings vs. the previous PNG flow.

## Next Steps

1. Verify Convex ↔ encoder integration in staging and capture baseline latency + error telemetry.
2. Audit hero/gallery components for opportunities to rely on intrinsic sizing while keeping the desired layout. _(In progress: gallery + hero now consume stored dimensions; confirm no regressions on mobile.)_
3. Monitor blur-placeholder usage in generated derivatives and ensure UI surfaces render them correctly.
4. Move the feature docs to `/documentation/features/completed/` once the gallery surfaces are updated and monitoring confirms the target cost reductions.
