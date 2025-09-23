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

## Implementation Phases

### Phase 1 – Backend Foundation

- Add `.index("by_originalImageId", ["originalImageId"])` to `images`.
- Ensure generated records copy `userId` (and relevant sharing defaults) from their originals.
- Implement `deleteImage` mutation that:
  - Uses `assertOwner` for originals; supports admin override path if needed later.
  - Collects generated derivatives via the new index.
  - Deletes storage blobs (`ctx.storage.delete`) before removing documents.
  - Returns structured counts for telemetry.
- Guard `retryOriginal` and `generateImage` against missing originals (log + exit).

### Phase 2 – Frontend Controls

- Add a destructive “Delete image” button to `ImageModal` with confirmation dialog.
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
