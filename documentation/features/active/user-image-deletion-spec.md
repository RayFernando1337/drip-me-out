# User Image Deletion Technical Specification

**Document Name:** User Image Deletion Plan  
**Date:** September 26, 2025  
**Version:** 1.0  
**Status:** Active

## Executive Summary

Give authenticated users full control over their uploads by allowing them to permanently delete originals and generated derivatives while also removing their Convex storage blobs. The shipped implementation cascades through related records, keeps share/public experiences in sync, and hardens the Convex actions so lingering generation work exits cleanly when source data disappears. Admin tooling remains out of scope for the current phase.

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
- **Mutations**: Ship the `images.deleteImage` mutation that enforces signed-in ownership (claiming legacy documents without `userId`), deduplicates cascaded targets, deletes Convex storage, and reports totals for UI messaging.
- **Actions**: Update the Gemini generation pipeline so `saveGeneratedImage` removes orphaned blobs and both `generateImage` and `updateImageStatus` quietly return when the source document no longer exists.
- **Frontend**: Surface a destructive delete control inside `ImageModal`, wrap it with confirmation UX, and rely on existing reactive queries/toasts to reflect deletions instantly across the gallery and share surfaces.
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
  - Auth: requires a signed-in user. The mutation asserts ownership via `assertOwner`; older documents missing `userId` are first patched to the caller before the check.
  - Admin override: not implemented. Moderation tooling must call this mutation as the owner or wait for Phase 3.
  - When `includeGenerated` is true (default) and the target is an original, gather derivatives via the `by_originalImageId` index and deduplicate any repeated references.
  - Deletes each Convex storage blob inside a `try/catch` (warnings logged, deletion continues) before removing the corresponding document.
  - Returns `{0,0}` when the target no longer exists and reports the number of generated images removed via `deletedGenerated`.

### Action Pipeline Resilience

- `generate.saveGeneratedImage` no-ops and deletes orphaned storage if the original is gone.
- `generate.updateImageStatus` silently returns if original is missing.
- `generate.generateImage` still attempts to progress statuses; if storage is missing it records a failure, otherwise any subsequent status writes are skipped because the document has already been removed.
- Net effect: deleting during `processing` removes the original immediately, future status updates become harmless no-ops, and derivative cleanup prevents stray blobs/documents.

### Frontend UX

- Location: `ImageModal`
  - Destructive button: "Delete image"
  - Confirmation dialog:
    - Title: "Delete this image?"
    - Body: "This will permanently remove the original upload and any generated versions from your gallery and storage. This action cannot be undone."
    - Actions: primary destructive "Delete permanently" (spinner copy "Deleting..." while in flight), secondary "Cancel".
  - States: disable primary action while request in-flight; close modal on success; toast on success/failure with contextual copy.
- Share page
  - If the image is deleted or sharing disabled/expired, render friendly empty state: "This image is no longer available."
- Accessibility
  - Focus trap in dialog; Escape to dismiss; confirm button has `aria-disabled` when pending.

## Acceptance Criteria (DoD)

- Owners can delete an original; all cascaded derivatives and their storage blobs are removed. Galleries immediately stop rendering the removed records via reactive queries.
- The backend supports deleting generated derivatives directly (UI still funnels through the original for now) and accurately reports `deletedGenerated`.
- Deleting during `pending`/`processing` removes the document and storage; any background status updates quietly no-op, leaving no residual activity or blobs.
- `deleteImage` returns accurate counts; the UI surfaces "Image deleted" success copy with derivative counts in the toast description.
- Share routes fall back to the "This image is no longer available" empty state immediately after deletion.
- No orphaned `_storage` blobs remain for deleted docs (warnings logged if storage delete fails, but mutation proceeds).
- Errors are owner-safe: unauthenticated → Error("Not authenticated"); unauthorized → Error("Not authorized to modify this image"); internal errors surface a generic failure toast.
- Modal and buttons meet a11y basics (keyboard, focus order, contrast).

## Error Handling & UX Mapping

- Not authenticated → HTTP 200 with thrown Error("Not authenticated") from Convex; UI shows sign-in CTA.
- Not owner → Error("Not authorized to modify this image"); UI shows a non-technical toast. Legacy images without `userId` are first patched to the caller before this check.
- Already deleted/missing → mutation resolves with `{0,0}`; UI shows "Already deleted." toast at info level.
- Storage delete failures are logged server-side and do not block document deletion.

## Performance & Limits

- Cascades use `by_originalImageId` index; no table scans.
- Typical fan-out small (handful of derivatives); looped deletes are acceptable. If fan-out grows, consider batch delete helpers.
- No additional rate limits beyond existing auth; UI should avoid duplicate submissions via pending state.

## Decisions & Open Questions

- Admin override scope: DEFERRED. Current mutation only allows owners; future moderation surfaces must either impersonate or add an explicit override.
- In-progress deletions: When a delete occurs during `pending`/`processing`, the backend removes the document and blobs immediately. Any later scheduler callbacks short-circuit because `ctx.db.get` returns `null`.
- Derivative-only delete: Backend supports it; UI affordance OUT OF SCOPE for Phase 2. Revisit with product.
- Telemetry: Optional. If added, emit `image.delete` with `{ deletedTotal, deletedGenerated }` plus actor metadata when moderation support arrives.

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
  - Requires ownership via `assertOwner`, patching legacy documents without `userId` to the caller.
  - Collects generated derivatives via the new index and deduplicates the set before deletion.
  - Deletes storage blobs (`ctx.storage.delete`) before removing documents, logging warnings but not failing on storage errors.
  - Returns structured counts for telemetry and UI copy.
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

- Ensure only the owner can delete images in the current release; future admin tooling must introduce explicit overrides.
- Avoid leaking sensitive data in error messages—convert internal errors to user-safe toasts.
- Double-check that share links become unusable immediately after deletion (query returns `null`).
- Treat deletion as irreversible; confirm no residual references remain in other tables before shipping.
