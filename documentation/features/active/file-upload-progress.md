# File Upload – Progress & Findings

Status: In progress  
Last updated: 2025-09-08 (auto-retry + Failed tab + manual retry implemented)

## Summary
Initial implementation landed and basic E2E works: client-side compression/transcoding, Convex upload + scheduling, and generated images appear in the gallery. During QA we observed two UX gaps and one intermittent upload error (Safari iOS). This doc tracks regressions, hypotheses, and the plan to polish the UX.

## Observed Issues

1) No gallery placeholder while generation is pending
- Behavior: After upload/capture, we only show completed images. Pending items are not represented in the gallery, which can feel like "nothing happened" until the generation finishes.
- Evidence:
  - We filter for generated images only: see [generatedImages filtering](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L72-L75)
  - We do have a global spinner badge: see [hasActiveGenerations indicator](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L344-L351), but no per-item placeholder.
- Likely cause: The gallery is fed by `generatedImages` while the original image (with `isGenerated: false`, `generationStatus: "pending"`) is excluded.

2) Upload error not clearly actionable for users
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
