# File Upload – Progress & Findings

Status: Completed  
Last updated: 2025-01-27 (architecture fixes and reactive UI implemented)

## Summary
✅ **COMPLETED** - All major issues have been resolved. The image processing pipeline now works correctly with both webcam captures and file uploads. The system uses a unified architecture that follows Convex best practices and provides reactive UI updates.

## Issues Resolved ✅

### 1. Gallery Placeholder While Generation is Pending
- **Status:** ✅ FIXED
- **Solution:** Updated UI to show all images (pending, processing, completed) except failed ones
- **Implementation:** Simplified reactive filtering in `app/page.tsx` using Convex's built-in reactivity

### 2. Upload Error Handling
- **Status:** ✅ FIXED  
- **Solution:** Created unified upload function with proper error handling and retry logic
- **Implementation:** `lib/unifiedUpload.ts` handles both webcam and file uploads with consistent error handling

### 3. Architecture Inconsistencies
- **Status:** ✅ FIXED
- **Solution:** Unified both upload paths to use the same processing pipeline
- **Implementation:** Both webcam and file upload now use `unifiedUpload` + `scheduleImageGeneration`

### 4. Schema and Type Safety Issues
- **Status:** ✅ FIXED
- **Solution:** Updated schema to use proper Convex types and added comprehensive validators
- **Implementation:** `storageId: v.id("_storage")`, proper ID types, and union types for status

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

## Action Items

- [x] ImagePreview supports a placeholder state for `generationStatus` in { pending, processing } (see overlay at [components/ImagePreview.tsx](file:///Users/ray/workspace/drip-me-out/components/ImagePreview.tsx#L105-L116)).
- [x] Update page data flow to include pending items and exclude failed from main gallery at [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L75-L86); pagination/effects updated at [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L95-L115), and gallery props at [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L400-L408).
- [x] Add Retry button and inline helper text on upload error; regenerate signed URL on retry in [Upload form UI](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L329-L391) and [retryUpload handler](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L176-L217).
- [x] Optional: add preparation progress state ("Preparing…") in [Upload button label](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L366-L373). Upload progress remains a follow-up.
- [x] Hide backend/internal errors (e.g., AI quota) behind generic, user-friendly copy; see [toUserMessage mapper](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L137-L147).
- [x] DRY upload/schedule flow with helper: [lib/uploadAndSchedule.ts](file:///Users/ray/workspace/drip-me-out/lib/uploadAndSchedule.ts#L1-L64), used in camera + upload paths.
- [x] Add dedicated Failed tab with manual retry wired to [retryOriginal](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L148-L170) at [app/page.tsx](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L416-L448).
- [x] Auto-retry once on generation failure via [maybeRetryOnce](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L121-L146).
- [ ] QA on Safari iOS with poor connectivity.

## References
- Spinner badge already present: [hasActiveGenerations](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L344-L351)
- Current gallery render: [ImagePreview](file:///Users/ray/workspace/drip-me-out/components/ImagePreview.tsx#L1-L200)
- Upload handler with toasts: [handleSendImage](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L187-L256)
- Server-side validation: [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102)
