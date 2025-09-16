# Unauthenticated Gallery - Implementation Progress Tracker

**Last Updated:** February 14, 2025  
**Specification:** [Unauthenticated Gallery Technical Specification](./unauthenticated-gallery-spec.md)

## Overview
The public gallery shipped once, but regression testing surfaced four critical gaps: pagination drops earlier pages, admin takedowns can be bypassed, unauthenticated users lack a modal/lightbox, and the authenticated modal hides controls on narrow viewports or extreme aspect ratios. Work is reopening to close those issues without regressing the existing sharing/feature flows.

## Phase Completion Summary
| Phase | Status | Completion | Notes |
|-------|--------|------------|-------|
| Phase 1 – Stabilize public pagination | Planned | 0% | Persist accumulated pages client-side, update loading UX, and re-test infinite browsing.
| Phase 2 – Enforce admin featured locks | Planned | 0% | Keep admin disables authoritative in Convex and reflect state in UI to prevent silent overrides.
| Phase 3 – Add unauthenticated read-only modal | Planned | 0% | Introduce a lightweight modal/lightbox that omits sharing controls but supports swipe/keyboard navigation.
| Phase 4 – Fix responsive modal layout | Planned | 0% | Ensure feature/sharing controls stay visible for portrait/landscape images and small screens.

## Current Tasks
- [ ] Phase 1: Cache previously fetched `getPublicGallery` pages in `components/PublicGallery.tsx`, guard against duplicate IDs, and confirm "Show more" continues appending results.
- [ ] Phase 1 Testing: Manually verify pagination on desktop + mobile breakpoints, then run `bunx convex dev` (no validation/schema errors) and `bun run build`.
- [ ] Phase 2: Update `api.images.updateFeaturedStatus` + related UI so admin-disabled images cannot be re-enabled by owners without moderation approval.
- [ ] Phase 2 Testing: Exercise owner/admin flows end-to-end, rerun `bunx convex dev`, and `bun run build` to confirm Convex + TypeScript health.
- [ ] Phase 3: Build a read-only `PublicImageModal` (or reuse existing modal with feature flags) and wire it to `PublicGallery` cards with accessible focus management.
- [ ] Phase 3 Testing: Validate modal navigation on keyboard and touch, ensure no auth-only controls leak, then run `bunx convex dev` and `bun run build`.
- [ ] Phase 4: Refactor modal layout to support scrollable content, responsive stacking, or adaptive sizing so controls stay within reach regardless of orientation.
- [ ] Phase 4 Testing: Check portrait, landscape, and small-screen scenarios, confirm scroll/zoom behaviour, and finish with `bunx convex dev` plus `bun run build`.

## Next Steps
- Tackle phases sequentially; each phase should leave the app deployable with pagination, moderation, and modal behaviour intact.
- After merging a phase, update this tracker (status + completion) before moving on.

## Blockers/Issues
- Pagination, admin enforcement, modal absence, and responsive layout bugs outlined in the specification remain unresolved.
- No external dependencies are blocking progress; fixes are confined to the existing frontend/Convex codepaths.
