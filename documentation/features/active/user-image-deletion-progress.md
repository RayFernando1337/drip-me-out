# User Image Deletion – Implementation Progress Tracker

**Last Updated:** September 23, 2025 (Phase 2 frontend controls validated; share CTA polish pending)  
**Specification:** [User Image Deletion Technical Specification](./user-image-deletion-spec.md)

## Overview

Reintroducing ownership tooling so authenticated users can delete any of their uploads (and the AI-generated derivatives) from both Convex storage and the gallery experiences. Work spans backend cascades, frontend UX, and resilience updates for the Gemini action pipeline.

## Phase Completion Summary

| Phase                        | Status | Completion | Notes                                                                                            |
| ---------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| Phase 1 – Backend foundation | ✅     | 100%       | Index + ownership propagation + `deleteImage` mutation + Gemini guards implemented.              |
| Phase 2 – Frontend controls  | 🔄     | 70%        | Modal delete UX, confirmation dialog, share-page fallback implemented; share CTA polish pending. |
| Phase 3 – Secondary surfaces | ⏸️     | 0%         | Admin dashboard integration, telemetry decisions.                                                |
| Phase 4 – QA & release       | ⏸️     | 0%         | Manual sweeps, typecheck/lint, documentation updates.                                            |

## Current Tasks

- [ ] Align on admin override scope (is admin delete in Phase 1 or Phase 3?).
- [ ] Confirm expectations for deleting in-progress generations (immediate cancel vs. background no-op).
- [x] Kick off Phase 1 once open questions are resolved; run `bunx convex dev` during backend work.
- [x] Add ownership propagation to generated images and schema index (done; verify tests/validation).
- [x] Implement `deleteImage` mutation with cascaded storage cleanup.
- [x] Add modal delete controls with confirmation.
- [x] Provide share page fallback when image is missing.
- [ ] Add toast/error scenarios for share page CTA (if needed).
- [x] Short-circuit Gemini mutation paths when originals are missing.
- [x] Tighten `mapImagesToUrls` helper to accept the storage contract from any Convex context.

## Next Steps

- Resolve outstanding decisions (admin override scope, behavior for in-progress deletions).
- Ship remaining Phase 2 polish (share CTA toast/error handling) and verify reactive gallery updates during delete flows.
- Prepare Phase 3 kickoff plan once Phase 2 closes (admin dashboard wiring, telemetry agreement).

## Blockers/Issues

- Pending product decision on whether users can delete generated derivatives individually or only via original cascades.
- Need clarity on logging/analytics requirements for deletions before instrumenting telemetry.
