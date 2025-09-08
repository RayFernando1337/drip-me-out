# File Upload – Progress & Findings

Status: **COMPLETED - Major Refactor**  
Last updated: 2025-01-27 (Comprehensive refactor addressing regressions and architecture issues)

## Summary

Initial implementation landed and basic E2E works: client-side compression/transcoding, Convex upload + scheduling, and generated images appear in the gallery. During QA we observed two UX gaps and one intermittent upload error (Safari iOS).

**MAJOR REFACTOR COMPLETED (2025-01-27):** Comprehensive refactor addressed multiple regressions where images were getting stuck as "processing" and violated Convex best practices. Key improvements:

- **Fixed Convex Schema Violations**: Updated schema with proper literal unions, correct ID types, and proper indexes
- **Consolidated Upload Logic**: Created single DRY backend upload path (`uploadAndScheduleGeneration`)
- **Improved Backend Reliability**: Enhanced error handling in generation pipeline to prevent stuck status
- **Simplified Frontend**: Removed complex pagination/filtering logic, leveraged Convex reactivity properly
- **Eliminated Code Duplication**: Single upload function used by both webcam and file upload

## Observed Issues

1. No gallery placeholder while generation is pending

- Behavior: After upload/capture, we only show completed images. Pending items are not represented in the gallery, which can feel like "nothing happened" until the generation finishes.
- Evidence:
  - We filter for generated images only: see [generatedImages filtering](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L72-L75)
  - We do have a global spinner badge: see [hasActiveGenerations indicator](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L344-L351), but no per-item placeholder.
- Likely cause: The gallery is fed by `generatedImages` while the original image (with `isGenerated: false`, `generationStatus: "pending"`) is excluded.

2. Upload error not clearly actionable for users

- Behavior: In Safari iOS, we saw errors such as:
  - Fetch API cannot load Convex storage upload URL due to access control checks
  - Network connection lost; TypeError: Load failed
- Evidence: Provided console logs during QA.
- Current UI: We show a toast on failure in [handleSendImage](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L247-L255), but we don't offer a guided retry with context (e.g., re-generate signed URL, retry upload). Users may not realize an immediate retry is likely to work.
- Hypotheses:
  - Safari iOS flakiness with cross-origin upload streams (transient network or CORS preflight anomalies).
  - Signed URL expiration during long client-side processing for very large images (compression/transcode time). Less likely, but possible on older devices.
  - Intermittent connectivity during mobile upload.

## Implemented (Frontend)

A) Show per-item pending placeholders in the gallery

- Approach: Include pending/processing originals in the grid with a shimmer card and status text.
- Options:
  - Minimal: Extend the grid data to also include items where `generationStatus` is `"pending" | "processing"` and `isGenerated === false`.
  - Visual: Render a placeholder card with a spinner and text like "Generating…"; optionally a cancel/retry affordance later.
- Touchpoints:
  - Data prep: combine pending/processing originals with generated and exclude failed from the main gallery. See [combinedImages](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L75-L86).
- UI: Update [ImagePreview](file:///Users/ray/workspace/drip-me-out/components/ImagePreview.tsx#L1-L200) to support a `generationStatus` overlay and a failure overlay.

B) More actionable error handling for uploads

- Add retry flow with fresh signed URL:
  - On failure, keep `selectedImage` in state and render a prominent inline error with a "Retry upload" button that re-requests `generateUploadUrl()` and retries the POST.
  - Optionally backoff once before surfacing the final error toast.
- Improve messaging:
  - Special-case `TypeError: Load failed` and network failures with a message like "Network lost during upload. Please retry." and a Retry action.
  - Keep current toasts but add inline helper text near the button for clarity.
- Optional: show progress during compression and upload (e.g., “Preparing 35%…”, then “Uploading…”). For upload progress we could use `XMLHttpRequest` to get progress events.

C) Keep the UI busy state more explicit

- Disable the file input during upload and generation (already implemented) and add an inline status label.
- Consider a small banner near the gallery indicating an item is pending (in addition to the corner spinner), with a link to scroll to the placeholder card.

## Implemented (Backend)

- Validation remains in scheduler: size and contentType via `_storage`.
- Pass through validated `contentType` to generator to avoid header mis-detections (HEIC/JPEG). See [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L112-L117) and [usage](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L168-L171).
- Auto-retry once on generation failure using `generationAttempts` and [maybeRetryOnce](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L121-L146).
- Manual retry via [retryOriginal](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L148-L170); wired in Failed tab.

## Regression Check

- Upload flow wiring: [handleSendImage](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L187-L246) now performs client-side prep and then uploads. This is correct and matches the spec.
- Gallery filtering: The code intentionally filters to `isGenerated` for display, which explains lack of placeholders and is not a regression but a gap to close.
- Server validation: [scheduleImageGeneration validation](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102) works and surfaces `VALIDATION:` errors to the client, which are handled in the UI.

## Acceptance Criteria Addendums (Polish)

- Pending images appear immediately in the main gallery as placeholders with clear status.
- Failed originals are listed only in the Failed tab with a clear Retry action; they are excluded from the main gallery.
- Upload failures present a clear call-to-action to retry; if retry succeeds, the flow continues without manual re-selection of the file.
- Auto-retry once is attempted server-side; persistent failures remain in the Failed tab until manually retried.
- Clearer messaging for transient network errors on Safari iOS.

## Resolution Summary (Major Refactor)

**All Original Issues RESOLVED through comprehensive refactor:**

### 1. Images Stuck as "Processing" - FIXED ✅

- **Root Cause**: Complex frontend state management and unreliable backend status updates
- **Solution**:
  - Enhanced backend error handling with guaranteed status updates
  - Simplified frontend to leverage Convex reactivity
  - New backend queries: `getGalleryImages`, `getFailedImages`, `hasActiveGenerations`

### 2. Convex Rules Violations - FIXED ✅

- **Schema Issues**: Fixed literal unions, proper ID types, better indexes
- **Query Issues**: Replaced client-side filtering with proper backend queries using indexes
- **Function Structure**: Consolidated upload logic into single backend mutation
- **Type Safety**: Proper validators and return types throughout

### 3. Code Duplication - FIXED ✅

- **Backend**: Single `uploadAndScheduleGeneration` mutation replaces duplicate logic
- **Frontend**: Single `uploadImage` function used by both webcam and file upload
- **Removed**: `lib/uploadAndSchedule.ts` helper (moved to backend)

### 4. Lost Reactive Nature - FIXED ✅

- **Simplified Queries**: No more complex pagination/filtering logic
- **Direct Convex Queries**: `galleryImages`, `failedImages`, `hasActiveGenerations`
- **Automatic Updates**: Status changes now update UI immediately via Convex reactivity

## Legacy Action Items (Completed)

- [x] ~~ImagePreview supports placeholder state~~ → **REPLACED** with reactive backend queries
- [x] ~~Update page data flow~~ → **REPLACED** with simplified `getGalleryImages` query
- [x] ~~Add Retry button~~ → **MAINTAINED** in refactored code
- [x] ~~Add preparation progress state~~ → **MAINTAINED** in consolidated upload function
- [x] ~~Hide backend errors~~ → **MAINTAINED** with `toUserMessage` mapper
- [x] ~~DRY upload/schedule flow~~ → **COMPLETED** via backend consolidation
- [x] ~~Add Failed tab~~ → **MAINTAINED** with `getFailedImages` query
- [x] ~~Auto-retry once~~ → **MAINTAINED** in enhanced backend flow
- [ ] QA on Safari iOS with poor connectivity → **PENDING** (infrastructure now more robust)

## References

- Spinner badge already present: [hasActiveGenerations](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L344-L351)
- Current gallery render: [ImagePreview](file:///Users/ray/workspace/drip-me-out/components/ImagePreview.tsx#L1-L200)
- Upload handler with toasts: [handleSendImage](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L187-L256)
- Server-side validation: [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102)
