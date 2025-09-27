# User Image Deletion Technical Specification

**Document Name:** User Image Deletion Plan  
**Date:** September 23, 2025  
**Version:** 0.1  
**Status:** Active

## Executive Summary

Give authenticated users full control over their uploaded content by allowing them to delete originals and any generated derivatives from both the database and Convex storage. The feature must cascade cleanly, respect existing sharing and featured gallery flows, and avoid leaving orphaned AI jobs or share links.

## Problem Statement

### Current Experience

- Users cannot delete uploads, so accidental or unwanted images remain visible in personal galleries and can continue to surface via sharing or public showcases.
- Generated derivatives inherit no explicit ownership metadata, complicating manual cleanup.
- Background generation jobs can continue running even if the source image is removed manually through database tools, risking errors.

### Opportunity

- Provide a trustworthy experience by letting users manage their content lifecycle.
- Reduce storage costs and legal risk by honoring deletion requests promptly.
- Harden backend flows (indexes, ownership propagation, job guards) for future moderation tooling.

## Architecture Overview

- **Schema**: Extend the `images` table with an index on `originalImageId` to support cascaded deletes without scans.
- **Mutations**: Add a new `deleteImage` mutation that verifies ownership, deletes related generated images, and removes associated blobs from Convex storage.
- **Actions**: Update the Gemini generation action to gracefully no-op if the original image disappears mid-process.
- **Frontend**: Surface a delete control in `ImageModal` with confirmation UX and rely on existing reactive queries for UI updates.
- **Docs & QA**: Track progress via paired spec/progress files and align with existing outstanding modal accessibility sweeps.

## Detailed Design

### Data Model & Indexes

- Table: `images`
  - Ownership: `userId` (Clerk subject) is propagated to all generated derivatives.
  - Generation fields: `generationStatus` (`pending` | `processing` | `completed` | `failed`), `generationError`, `generationAttempts`.
  - Sharing fields: `sharingEnabled` (default true for b/c), `shareExpiresAt`.
  - Public gallery/admin: `isFeatured`, `featuredAt`, `isDisabledByAdmin`, `disabledByAdminReason`.
- Indexes (relevant):
  - `by_originalImageId` — used to gather derivatives for cascade deletion.
  - `by_is_generated`, `by_generation_status`, `by_is_generated_and_status` — existing gallery flows unaffected by deletes.

### Mutation Contract: deleteImage

- Name: `images.deleteImage`
- Args:
  - `imageId: Id<"images">` — target image (original or derivative)
  - `includeGenerated?: boolean` — default `true`; when true and the target is an original, cascades to its derivatives
- Returns:
  - `{ deletedTotal: number; deletedGenerated: number }`
- Behavior:
  - Auth: requires signed-in user. Owners can delete their own images. Admins (verified via `assertAdmin`) may delete any image without ownership checks.
  - Legacy ownership gap: if the document lacks `userId` and caller is not an admin, claim ownership by the current user before proceeding.
  - Gathers derivatives via `by_originalImageId` when applicable.
  - Deletes Convex storage blobs first, then removes documents.
  - Idempotent-ish: returns `{0,0}` if the `imageId` no longer exists.

### Action Pipeline Resilience

- `generate.saveGeneratedImage` no-ops and deletes orphaned storage if the original is gone.
- `generate.updateImageStatus` silently returns if original is missing.
- `generate.generateImage` marks original `failed` when storage is missing or errors occur; auto-retries once where appropriate.
- Net effect: deleting during `processing` yields a final state of `failed` with user-facing messaging about cancellation, and no orphaned blobs/docs.

### Frontend UX

- Location: `ImageModal`
  - Destructive button: "Delete image"
  - Confirmation dialog:
    - Title: "Delete image?"
    - Body (original, owner view): "Deleting will cancel any in-progress generation and remove the original plus all generated versions. This cannot be undone."
    - Body (original, admin view): "Deleting will remove this photo and every generated version for the user. This cannot be undone."
    - Body (derivative-only, if enabled later): "Deleting will remove this generated image. The original stays available."
    - Admin affordance: when triggered by an admin (no ownership), include subtext "The user will lose access immediately." below the body copy.
    - Actions: primary destructive "Delete", secondary "Cancel"
  - States: disable primary button while request in-flight; close modal on success; toast on success/failure.
- Share page
  - If the image is deleted or sharing disabled/expired, render friendly empty state: "This image is no longer available."
- Accessibility
  - Focus trap in dialog; Escape to dismiss; confirm button has `aria-disabled` when pending.

## Acceptance Criteria (DoD)

- Owners can delete an original; all its derivatives and storage blobs are removed. Gallery and share links reflect deletion without refresh.
- Owners can delete a generated derivative if a UI affordance exists (not required for Phase 2); backend supports it safely.
- Deleting during `pending`/`processing` cancels the job: original transitions to `failed` with `generationError` of "Canceled by user", and no residual activity remains.
- `deleteImage` returns accurate counts; UI surfaces a success toast like: "Image deleted. Removed 1 original and N generated versions." Admin delete toasts add trailing copy: "The user can no longer access this photo."
- Share routes return "not found" or the empty state immediately after deletion.
- No orphaned `_storage` blobs remain for deleted docs.
- Errors are owner-safe: unauthenticated → prompt to sign in; unauthorized → generic "You can only delete your own images."; internal errors → generic "Something went wrong".
- Modal and buttons meet a11y basics (keyboard, focus order, contrast).

## Error Handling & UX Mapping

- Not authenticated → HTTP 200 with thrown Error("Not authenticated") from Convex; UI shows sign-in CTA.
- Not owner → Error("Not authorized to modify this image"); UI shows non-technical message. Admins never receive this error.
- Already deleted/missing → mutation resolves with `{0,0}`; UI shows "Already deleted." toast at info level.
- Storage delete failures are logged server-side and do not block document deletion.

## Performance & Limits

- Cascades use `by_originalImageId` index; no table scans.
- Typical fan-out small (handful of derivatives); looped deletes are acceptable. If fan-out grows, consider batch delete helpers.
- No additional rate limits beyond existing auth; UI should avoid duplicate submissions via pending state.

## Decisions & Open Questions

- Admin override scope: ENABLED in Phase 1 via `assertAdmin`. Admin delete follows same cascade but bypasses ownership checks.
- In-progress deletions: When a delete occurs during `pending`/`processing`, the backend immediately marks the original `failed` with `generationError = "Canceled by user"` and ensures the Gemini action returns early if encountered. Users see messaging that the job was canceled mid-generation.
- Derivative-only delete: Backend supports it; UI affordance OUT OF SCOPE for Phase 2. Revisit with product.
- Telemetry: Optional. If added, emit `image.delete` with `{ deletedTotal, deletedGenerated }` (owner/admin, timestamp).

## Rollout & QA Plan

- Keep `bunx convex dev` open; fix all reported errors.
- Pre-ship checks: `bun run build`, `bun run lint`.
- Manual QA matrix:
  - Originals in each status: `pending`, `processing`, `completed`, `failed`.
  - Share page before/after deletion; ensure null response yields empty state.
  - Public gallery and featured flows continue working with missing docs.
  - Admin moderation views remain stable with deleted/missing docs.
  - Accessibility sweep on modal and toast timings.

## Out of Scope (Now)

- Soft delete/undo. All deletes are permanent.
- Bulk multi-select deletion.
- Telemetry dashboards; only basic logging is considered.


## Implementation Phases

### Phase 1 – Backend Foundation

- Add `.index("by_originalImageId", ["originalImageId"])` to `images`.
- Ensure generated records copy `userId` (and relevant sharing defaults) from their originals.
- Implement `deleteImage` mutation that:
  - Uses `assertOwner` for originals but allows admin override via `assertAdmin` (bypassing ownership checks).
  - Collects generated derivatives via the new index.
  - Deletes storage blobs (`ctx.storage.delete`) before removing documents.
  - Returns structured counts for telemetry.
- Guard `retryOriginal` and `generateImage` against missing originals (log + exit).

### Phase 2 – Frontend Controls

- Add a destructive “Delete image” button to `ImageModal` with confirmation dialog copy above.
- Disable the action while uploads are in-flight if necessary; otherwise rely on backend safeguards.
- Close the modal and show toast feedback on success; display backend error messages on failure.
- Double-check gallery accumulators (`ImagePreview`, `PublicGallery`) remove deleted items without manual refresh.
- Update share route to show a friendly “This image has been deleted” state if not already present.

### Phase 3 – Secondary Surfaces & Admin Options

- Decide whether admins can trigger the same mutation (e.g., from `AdminModerationDashboard`).
- Confirm featured gallery queries handle missing documents seamlessly.
- Consider lightweight logging/metrics for deletion events (optional).

### Phase 4 – QA, Docs, and Release

- Keep `bunx convex dev` running during backend work; resolve any reported errors.
- Run `bun run build` and `bun run lint` after code changes.
- Manual exploratory QA:
  - Delete originals in `pending`, `processing`, `completed`, and `failed` states.
  - Confirm share links return “not found” after deletion.
  - Regression-test unauthenticated gallery and admin moderation flows.
  - Re-run outstanding modal accessibility sweep.
- Update progress tracker after each phase.

## Testing & Verification

- **Automated**: Existing typecheck and lint commands (`bun run build`, `bun run lint`).
- **Manual**:
  - Simulate slow deletion during active generation to ensure action logging is clean.
  - Verify storage entries vanish (`ctx.storage.getUrl` returns null) post-delete.
  - Exercise share pages, public gallery, and admin dashboards for consistency.
- **Future Enhancements** (Optional): Add unit-style tests for helper logic if Convex actions are refactored into pure functions.

## Security Considerations

- Ensure only the owner (or admins) can delete images.
- Avoid leaking sensitive data in error messages—convert internal errors to user-safe toasts.
- Double-check that share links become unusable immediately after deletion (query returns `null`).
- Treat deletion as irreversible; confirm no residual references remain in other tables before shipping.
