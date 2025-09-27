# User Image Deletion – Implementation Progress Tracker

**Last Updated:** September 26, 2025 (Owner-only deletion shipped; admin tooling deferred)  
**Specification:** [User Image Deletion Technical Specification](./user-image-deletion-spec.md)

## Overview

Reintroducing ownership tooling so authenticated users can delete any of their uploads (and the AI-generated derivatives) from both Convex storage and the gallery experiences. Work spans backend cascades, frontend UX, and resilience updates for the Gemini action pipeline.

## Phase Completion Summary

| Phase                        | Status | Completion | Notes                                                                                            |
| ---------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------ |
| Phase 1 – Backend foundation | ✅     | 100%       | Index + ownership propagation + `deleteImage` mutation + Gemini guards implemented (owner-only enforcement live). |
| Phase 2 – Frontend controls  | ✅     | 100%       | ImageModal delete flow, confirmation dialog, toasts, and share-page fallback shipped; reactive queries update instantly. |
| Phase 3 – Secondary surfaces | 🔄     | 70%        | Admin dashboard wired to `deleteImage`; telemetry/logging decision still pending.                |
| Phase 4 – QA & release       | ⏸️     | 0%         | Manual sweeps, typecheck/lint, documentation updates.                                            |

## Current Tasks

- [x] Scope administrative delete entry point (Phase 3) and wire `AdminModerationDashboard` to the shared mutation.
- [ ] Decide whether telemetry/logging for deletion events is required before enabling admin surfaces.
- [ ] Draft Phase 4 QA checklist (typecheck, lint, manual coverage) once secondary surfaces plan is settled.

## Next Steps

- Evaluate telemetry requirements alongside admin work; add structured events if approved.
- Stand up the Phase 4 QA plan after secondary surfaces land.
- Monitor admin deletes in production to ensure reactivity behaves as expected; expand tooling if gaps appear.

## Blockers/Issues

- Pending product decision on whether users can delete generated derivatives individually or only via original cascades.
- Awaiting alignment on moderation strategy (impersonation vs. override) before building admin entry points.
- Need clarity on logging/analytics requirements for deletions before instrumenting telemetry.
