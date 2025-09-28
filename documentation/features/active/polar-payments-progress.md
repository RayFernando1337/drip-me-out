# Polar Payments & Credits - Implementation Progress Tracker

**Last Updated:** 2025-09-27  
**Specification:** [polar-payments-spec.md](./polar-payments-spec.md)

## Overview
Phase 1 (Sandbox) foundations are implemented and typechecked: schema (`users`, `payments`, `billingSettings`), checkout action, webhook with signature verification (Standard Webhooks HMAC), admin settings APIs, and a Buy Credits UI. Test checkout succeeds and credits are granted via webhook.

## Phase Completion Summary
| Phase  | Status | Completion | Notes |
|--------|--------|------------|-------|
| Phase 1 — Foundations | ✅ | 100% | Sandbox checkout, webhook, admin settings in place; email/name prefill enabled |
| Phase 2 — Generation Gating | ⏸️ | 0% | Gate generation by credits; refund on final failure |
| Phase 3 — UX & Admin | ⏸️ | 0% | Balance display, 0-credit CTA, admin payments view |

## Current Tasks
- [ ] Phase 2: Enforce auth + atomic credit decrement in `images.uploadAndScheduleGeneration` before scheduling
- [ ] Phase 2: On final failure in `generate.ts`, refund 1 credit when `billingSettings.refundOnFailure` is true
- [ ] Phase 3: Show user credit balance in header/menu and disable generation at 0 credits with CTA
- [ ] Phase 3: Admin billing UI (edit `billingSettings`), simple payments list

## Next Steps
1. Implement credit gating in `uploadAndScheduleGeneration` and add tests for concurrency.
2. Add refund path in `generate.ts` final-failure branch; ensure idempotency.
3. Surface credit balance in UI; add upgrade CTA when balance is 0.

## Blockers/Issues
- None currently. Ensure `POLAR_WEBHOOK_SECRET` is base64 encoded as required by Standard Webhooks.
