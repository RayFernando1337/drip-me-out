# Polar Payments & Credits - Implementation Progress Tracker

**Last Updated:** 2025-09-28  
**Specification:** [polar-payments-spec.md](./polar-payments-spec.md)

## Overview

Phase 1 (Sandbox) foundations are implemented and typechecked: schema (`users`, `payments`, `billingSettings`), checkout action, a single orders webhook with signature verification (Standard Webhooks HMAC), admin settings APIs, and a Buy Credits UI. Test checkout succeeds and credits are granted via webhook. We simplified to one webhook endpoint for one‑time purchases (`/polar/orders`) and do not use the Polar component (subscriptions) in this flow.

## Phase Completion Summary

| Phase                       | Status | Completion | Notes                                                                          |
| --------------------------- | ------ | ---------- | ------------------------------------------------------------------------------ |
| Phase 1 — Foundations       | ✅     | 100%       | Sandbox checkout, webhook, admin settings in place; email/name prefill enabled |
| Phase 2 — Generation Gating | ⏸️     | 0%         | Gate generation by credits; refund on final failure                            |
| Phase 3 — UX & Admin        | ⏸️     | 0%         | Balance display, 0-credit CTA, admin payments view                             |

## Current Tasks

- [ ] Phase 2: Enforce auth + atomic credit decrement in `images.uploadAndScheduleGeneration` before scheduling
- [ ] Phase 2: On final failure in `generate.ts`, refund 1 credit when `billingSettings.refundOnFailure` is true
- [ ] Phase 3: Show user credit balance in header/menu and disable generation at 0 credits with CTA
- [ ] Phase 3: Admin billing UI (edit `billingSettings`), simple payments list

## Spec Alignment (quick audit)

- [x] Data model (`users`, `payments`, `billingSettings`) — implemented
- [x] Checkout session creation (server action) — implemented
- [x] Webhook fulfillment — implemented at `/polar/orders` (spec listed `/polar/webhook`); signature verified via Standard Webhooks; idempotent on `orderId`
- [x] User mapping — fulfilled by `externalCustomerId` → `getOrCreateUser(userId)` during order processing; Clerk webhook not required
- [ ] Credit gating before generation — Phase 2
- [ ] Refund on final failure — Phase 2
- [ ] UX surfacing of balance + admin screens — Phase 3

## Next Steps

1. Implement credit gating in `uploadAndScheduleGeneration` and add tests for concurrency.
2. Add refund path in `generate.ts` final-failure branch; ensure idempotency.
3. Surface credit balance in UI; add upgrade CTA when balance is 0.
4. (Docs) Update spec endpoint path to `/polar/orders` (we chose a dedicated orders route for one‑time purchases).

## Blockers/Issues

- None currently. Base64 handling of `POLAR_WEBHOOK_SECRET` is done in code; store the raw secret in Convex env.
