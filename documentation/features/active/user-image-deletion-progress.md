# User Image Deletion – Implementation Progress Tracker

**Last Updated:** September 23, 2025 (Phase 1 backend foundations in progress)  
**Specification:** [User Image Deletion Technical Specification](./user-image-deletion-spec.md)

## Overview

Reintroducing ownership tooling so authenticated users can delete any of their uploads (and the AI-generated derivatives) from both Convex storage and the gallery experiences. Work spans backend cascades, frontend UX, and resilience updates for the Gemini action pipeline.

## Phase Completion Summary

| Phase                        | Status | Completion | Notes                                                                                             |
| ---------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------- |
| Phase 1 – Backend foundation | 🔄     | 40%        | Added `by_originalImageId` index, propagate ownership to generated images, draft delete mutation. |
| Phase 2 – Frontend controls  | ⏸️     | 0%         | Modal delete UX, toast/confirmation flows, share-page fallback.                                   |
| Phase 3 – Secondary surfaces | ⏸️     | 0%         | Admin dashboard integration, telemetry decisions.                                                 |
| Phase 4 – QA & release       | ⏸️     | 0%         | Manual sweeps, typecheck/lint, documentation updates.                                             |

## Current Tasks

- [ ] Align on admin override scope (is admin delete in Phase 1 or Phase 3?).
- [ ] Confirm expectations for deleting in-progress generations (immediate cancel vs. background no-op).
- [x] Kick off Phase 1 once open questions are resolved; run `bunx convex dev` during backend work.
- [x] Add ownership propagation to generated images and schema index (done; verify tests/validation).
- [ ] Implement `deleteImage` mutation with cascaded storage cleanup (in progress).
- [ ] Short-circuit Gemini mutation paths when originals are missing.

## Next Steps

- Gather stakeholder answers for the open questions above.
- Begin Phase 1 implementation and update tracker entries as milestones complete.

## Blockers/Issues

- Pending product decision on whether users can delete generated derivatives individually or only via original cascades.
- Need clarity on logging/analytics requirements for deletions before instrumenting telemetry.
