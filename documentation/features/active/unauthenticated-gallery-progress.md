# Unauthenticated Gallery - Implementation Progress Tracker

**Last Updated:** September 15, 2025 (Phase IV responsive modal layout)  
**Specification:** [Unauthenticated Gallery Technical Specification](./unauthenticated-gallery-spec.md)

## Overview
The public gallery shipped once, but regression testing surfaced four critical gaps: pagination drops earlier pages, admin takedowns can be bypassed, unauthenticated users lack a modal/lightbox, and the authenticated modal hides controls on narrow viewports or extreme aspect ratios. Work is reopening to close those issues without regressing the existing sharing/feature flows.

## Phase Completion Summary
| Phase | Status | Completion | Notes |
|-------|--------|------------|-------|
| Phase 1 – Stabilize public pagination | Complete | 100% | Accumulate pages locally in `PublicGallery`, dedupe IDs, and expose loading state.
| Phase 2 – Enforce admin featured locks | Complete | 100% | Mutation now preserves admin disables; modal toggle shows lock messaging.
| Phase 3 – Add unauthenticated read-only modal | Complete | 100% | `PublicImageModal` now uses split layout, scrollable copy, and CTA-only controls; keyboard/touch QA still recommended.
| Phase 4 – Fix responsive modal layout | Complete | 100% | Both public and authenticated modals use flexible two-pane layouts so controls remain reachable on small screens and extreme aspect ratios.

## Current Tasks
- [x] Phase 1: Cache previously fetched `getPublicGallery` pages in `components/PublicGallery.tsx`, guard against duplicate IDs, and confirm "Show more" continues appending results.
- [ ] Phase 1 Testing: Manually verify pagination on desktop + mobile breakpoints, then run `bunx convex dev` (no validation/schema errors) and `bun run build`. *(Build + Convex checks completed; manual cross-device sweep still recommended.)*
- [x] Phase 2: Update `api.images.updateFeaturedStatus` + related UI so admin-disabled images cannot be re-enabled by owners without moderation approval.
- [ ] Phase 2 Testing: Exercise owner/admin flows end-to-end, rerun `bunx convex dev`, and `bun run build` to confirm Convex + TypeScript health. *(Automated checks pass; end-to-end owner/admin QA still pending.)*
- [x] Phase 3: Build a read-only `PublicImageModal` (or reuse existing modal with feature flags) and wire it to `PublicGallery` cards with accessible focus management.
- [ ] Phase 3 Testing: Validate modal navigation on keyboard and touch, ensure no auth-only controls leak, then run `bunx convex dev` and `bun run build`. *(Build/Convex checks pass; manual desktop/mobile sweep still outstanding.)*
- [ ] Phase 4 Testing: Check portrait, landscape, and small-screen scenarios, confirm scroll/zoom behaviour, and finish with `bunx convex dev` plus `bun run build`. *(Responsive refactor committed; need exploratory QA.)*

## Next Steps
- Tackle phases sequentially; each phase should leave the app deployable with pagination, moderation, and modal behaviour intact.
- After merging a phase, update this tracker (status + completion) before moving on.

## Blockers/Issues
- Manual cross-device QA for the refreshed modals (keyboard, screen reader, and touch) still needs to happen before sign-off.
- No external dependencies are blocking progress; fixes are confined to the existing frontend/Convex codepaths.
