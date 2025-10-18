# WebP Master Upload Pipeline – Technical Specification

**Document Name:** WebP Master Upload & Metadata Modernization  
**Date:** 2025-10-17  
**Version:** v1.0  
**Status:** Active

## Executive Summary
Transform the upload pipeline so every user-provided asset is stored in Convex as an optimized WebP master enriched with intrinsic metadata (dimensions, MIME type, optional blur placeholder). This shifts work client-side, cutting the number and weight of Vercel transformations observed in production (current first-hit reductions range 93 – 99 %, per Observability dashboard) and gives the UI precise sizing data to generate tighter `srcset`s. The initiative replaces JPEG masters, tightens pre-upload compression, and ensures both user uploads and AI-generated derivatives result in complete metadata records.

## Current Observations
- **Vercel Image Optimization metrics:** Recent dashboard snapshot shows 35 transformations over 12 hours with write-heavy cache usage (≈3 MB inputs → 20 – 461 kB WebP outputs). Each initial view incurs costly re-encoding because masters remain multi-megabyte JPEGs.
- **Upload prep today:** `lib/imagePrep.ts` transcodes HEIC→JPEG and compresses to ≤5 MB, ≤2048 px, but keeps JPEG output. No intrinsic dimensions or placeholder data are recorded.
- **Schema state:** `images` table lacks metadata fields beyond storage ID and status. Generated images inherit no sizing info.
- **Frontend rendering:** Components rely on `fill` mode with `sizes`, so Next.js assumes full-viewport width for initial requests, increasing transformation variants.
- **Audience:** Early adopters on modern browsers (2025 baseline) → no need for JPEG fallback.

## Research References
- **Next.js Image Component:** width/height guidance, `sizes`, `placeholder`, cache behavior [Next.js docs](https://nextjs.org/docs/app/api-reference/components/image); `getImageProps` background usage [Next.js docs](https://nextjs.org/docs/app/building-your-application/optimizing/images).
- **Vercel Image Optimization pipeline:** remote pattern requirements, transformation billing, cache semantics [Vercel docs](https://vercel.com/docs/image-optimization#how-image-optimization-works).
- **Client compression libraries:**  
  - `browser-image-compression` options (`fileType`, `maxWidthOrHeight`, web worker support) [GitHub README](https://raw.githubusercontent.com/Donaldcwl/browser-image-compression/main/README.md).  
  - `heic2any` HEIC→WebP conversion using `toType` [Tutorial](https://www.cnblogs.com/longmo666/p/18508162).
- **Intrinsic dimension extraction:** `createImageBitmap` baseline support to read width/height from blobs [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap).
- **Blur placeholders:** DIY via downscaled canvas; integrates with Next.js `placeholder="blur"` (no extra dependency).

## Architecture Overview
- **Client (Next.js 15 App Router)**  
  - Extend `lib/imagePrep.ts` to:
    - Convert HEIC/HEIF inputs to WebP via `heic2any({ blob, toType: "image/webp", quality: 0.85 })`.
    - Compress all uploads to WebP with `browser-image-compression`, adjusting caps to `maxWidthOrHeight ≈ 1600` (align with largest rendered `sizes` value) and `maxSizeMB ≈ 3`.
    - Use `createImageBitmap` (or `Image`) to extract `naturalWidth`/`naturalHeight`.  
    - Optionally generate a ≤1 KB blur preview using `OffscreenCanvas` → `canvas.toDataURL("image/webp", 0.5)`.
  - Return enriched metadata `{ file, width, height, contentType: "image/webp", blurDataUrl?, wasTranscoded, wasCompressed }` to upload flow.

- **Convex Backend**  
  - Schema updates:
    - Add fields to `images`: `contentType`, `originalWidth`, `originalHeight`, `placeholderBlurDataUrl?`.
    - Consider `originalSizeBytes` for future analytics (optional).
  - `uploadAndScheduleGeneration` mutation:
    - Extend validator to accept metadata; allow `image/webp` in MIME check.
    - Persist metadata when inserting original image doc.
    - Ensure scheduling logic continues unchanged.
  - Helpers:
    - `mapImagesToUrls` should merge metadata into returned payloads.
    - Any generated-image writes must also populate metadata (see below).

- **Generated Images**
  - After AI generation completes, download the stored blob, compute dimensions (and optional blur) server-side (Node `sharp` unavailable—use `createImageBitmap` via `canvas`? or reuse existing client helper via action).  
  - Persist metadata on generated doc before marking status `completed`. This prevents assuming original dimensions match the output.

- **Frontend Consumers**
  - Update components (`ImageModal`, `PublicGallery`, `HeroGalleryDemo`, `ImageWithFallback`, share page) to:
    - Use explicit `width`/`height` when available (drop `fill` where static sizes suffice).
    - Pass `placeholder="blur"` with stored `blurDataUrl` when defined.
    - Continue using `sizes` but ensure values match actual layout widths (e.g. hero max 640 px).
  - Regenerate Convex client types and update type inferences accordingly.

## Detailed Implementation Phases

| Phase | Scope | Key Tasks | Outputs |
|-------|-------|-----------|---------|
| **Phase 1 – Client Prep Upgrade** | `lib/imagePrep.ts`, uploader in `app/page.tsx` | Implement WebP conversion/compression, metadata extraction, blur generation; adjust upload flow to pass metadata; tune quality/dimension caps. | Smaller upload payloads, metadata ready for backend. |
| **Phase 2 – Backend Schema & Mutation** | `convex/schema.ts`, `convex/images.ts`, `convex/lib/images.ts` | Add metadata fields & validators; allow `image/webp`; persist metadata; propagate via helpers. | Schema migration complete, API returns metadata. |
| **Phase 3 – Generated Asset Metadata** | Convex generate pipeline (`generate.ts`, storage helpers) | After AI job, recompute WebP metadata and update doc; consider generating blur placeholder in action. | Consistent metadata for originals and derivatives. |
| **Phase 4 – Frontend Consumers & UX** | Image components/modals/galleries/share pages | Use new metadata for `width`/`height`, `placeholder`, fallback logic; ensure `ImageWithFallback` handles `blurDataUrl`. | Optimized rendering, fewer transformation variants. |
| **Phase 5 – Documentation & Verification** | Agent guides, docs, QA | Update `app/AGENTS.md`, `components/AGENTS.md`, `convex/AGENTS.md`; run lint/build; manual end-to-end tests; monitor Vercel dashboard post-deploy. | Documented patterns, validated pipeline, measurable improvements. |

## Blur Placeholder Strategy
- Generate in-browser during upload using already-compressed WebP to avoid extra fetches.
- Downscale to ~24 × 24 px via `OffscreenCanvas`, encode at very low quality.
- Store as short base64 string; optional toggle if storage needs to remain minimal (since average <800 B).
- Apply via `placeholder="blur"` and `blurDataURL` in Next.js image components (per docs, this avoids additional requests).

## Testing & Verification
- **Local:**  
  - `bunx convex dev` (schema/mutation validation)  
  - `bun run lint`, `bun run build`  
  - Manual upload of JPEG/PNG/HEIC to confirm WebP output, metadata stored, UI renders with correct dimensions/placeholder.
- **Instrumentation:**  
  - Inspect Convex records for new fields.  
  - Confirm Next.js `Image` renders without console warnings for sizes or missing props.  
  - Review Vercel Image Optimization dashboard for reduced transformation counts/bytes.

## Security Considerations
- Continue validating content type and file size before credit consumption.  
- Ensure blur placeholder generation does not expose raw image data in logs.  
- Persist only necessary metadata (no EXIF).  
- Maintain existing auth checks around upload mutations and AI generation jobs.

## Notes & Decisions
- JPEG fallback is intentionally skipped; audience uses modern browsers (2025 baseline).  
- Blur placeholder remains optional—implemented only if storage overhead is acceptable after measurement.  
- Generated images must always recompute metadata post-processing to avoid stale or incorrect assumptions.

## Monitoring & Success Criteria
- **Primary KPI:** Reduction in Vercel image transformation write units per unique image (expect ≥75 % drop on first render).  
- **Secondary metrics:**  
  - Reduced edge cache storage due to smaller masters.  
  - Faster LCP on gallery/hero pages (from `Next.js` analytics).  
  - Stable UI with fewer layout shifts thanks to accurate intrinsic sizes.
- **Post-deploy checklist:** Compare Observability snapshot before/after (transformation count, source vs. transformed size). Verify no regressions in AI generation pipeline.
