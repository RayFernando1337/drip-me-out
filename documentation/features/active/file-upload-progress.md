# File Upload – Progress & Findings

Status: In progress  
Last updated: 2025-09-08

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

## Proposed Fixes (Frontend)

A) Show per-item pending placeholders in the gallery
- Approach: Include pending/processing originals in the grid with a shimmer card and status text.
- Options:
  - Minimal: Extend the grid data to also include items where `generationStatus` is `"pending" | "processing"` and `isGenerated === false`.
  - Visual: Render a placeholder card with a spinner and text like "Generating…"; optionally a cancel/retry affordance later.
- Touchpoints:
  - Data prep: modify `generatedImages` logic to maintain two arrays (pending + completed) or merge and render by status. See [generatedImages derivation](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L72-L75).
  - UI: Update [ImagePreview](file:///Users/ray/workspace/drip-me-out/components/ImagePreview.tsx#L1-L200) to support a `generationStatus` variant and render a placeholder for non-generated items.

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

## Proposed Fixes (Backend)

- No backend changes strictly required for the two issues above.
- Optional: add a short-lived, slightly longer signed URL duration if we confirm expiration during large-client-prep conditions (only if logs show token expiry). Currently not proven.

## Regression Check

- Upload flow wiring: [handleSendImage](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L187-L246) now performs client-side prep and then uploads. This is correct and matches the spec.
- Gallery filtering: The code intentionally filters to `isGenerated` for display, which explains lack of placeholders and is not a regression but a gap to close.
- Server validation: [scheduleImageGeneration validation](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102) works and surfaces `VALIDATION:` errors to the client, which are handled in the UI.

## Acceptance Criteria Addendums (Polish)

- Pending images appear immediately in the gallery as placeholders with clear status.
- Upload failures present a clear call-to-action to retry; if retry succeeds, the flow continues without manual re-selection of the file.
- Clearer messaging for transient network errors on Safari iOS.

## Action Items

- [ ] ImagePreview supports a placeholder state for `generationStatus` in { pending, processing }.
- [ ] Update page data flow to include pending items (or maintain separate arrays and interleave).
- [ ] Add Retry button and inline helper text on upload error; regenerate signed URL on retry.
- [ ] Optional: add compression/upload progress UI.
- [ ] QA on Safari iOS with poor connectivity.

## References
- Spinner badge already present: [hasActiveGenerations](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L344-L351)
- Current gallery render: [ImagePreview](file:///Users/ray/workspace/drip-me-out/components/ImagePreview.tsx#L1-L200)
- Upload handler with toasts: [handleSendImage](file:///Users/ray/workspace/drip-me-out/app/page.tsx#L187-L256)
- Server-side validation: [convex/generate.ts](file:///Users/ray/workspace/drip-me-out/convex/generate.ts#L89-L102)
