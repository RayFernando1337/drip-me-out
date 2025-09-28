# Polar Payments & Credits – Technical Specification

**Document Name:** polar-payments-spec.md  
**Date:** 2025-09-27  
**Version:** v0.1  
**Status:** Active

## Executive Summary
Introduce paid credits via Polar so users can purchase a $5 credit pack and spend credits to generate images. Purchases are handled through Polar Checkout Sessions; fulfillment happens via Polar webhooks that credit the user’s account in Convex. Image generation is gated by available credits.

## Architecture Overview

### Data Model (Convex)
- New table: `users` (or `accounts`)
  - `userId: string` (Clerk subject, indexed)
  - `credits: number` (default 0)
  - `polarCustomerId?: string`
  - `createdAt: number`
  - `updatedAt: number`
- New table: `payments`
  - `orderId: string` (Polar order id, unique, indexed)
  - `userId: string`
  - `amountCents: number`
  - `creditsGranted: number`
  - `status: "paid" | "refunded" | "failed"`
  - `createdAt: number`

- New table: `billingSettings` (admin-editable, single-row pattern)
  - `packPriceCents: number` (default 500)
  - `creditsPerPack: number` (default 420)
  - `refundOnFailure: boolean` (default true)
  - `freeTrialCredits: number` (default 10)
  - `updatedAt: number`
  - `updatedBy: string` (admin userId)

Notes:
- Keep `images.userId: string` as-is (Clerk subject) and reference it from `users`/`payments` by `userId` string.
- All Convex public functions must include validators and return types per CLAUDE.md.

### Payment Flow (Polar)
1. Server (Convex or Next.js route) creates a Polar Checkout Session using an Organization Access Token (OAT): `POST /v1/checkouts/`.
   - Attach `customer.external_id = <clerkSubject>` so we can identify the buyer.
   - Use sandbox server in development: `https://sandbox-api.polar.sh/v1`.
2. Client confirms checkout via Polar’s client confirmation flow using `client_secret` (Confirm Checkout Session from Client: `POST /v1/checkouts/client/{client_secret}/confirm`).
3. Polar sends webhooks (e.g., `order.updated`) to our webhook endpoint.
4. Webhook handler verifies signature and, on `status = paid/complete`, increments user credits and records a `payments` row (idempotent by `orderId`).

### Credit Consumption (Generation Gate)
- Update `uploadAndScheduleGeneration` to require auth and atomically decrement 1 credit before scheduling generation; if insufficient credits, return error.
- Auto-retries should not consume additional credits. If generation ultimately fails, always refund 1 credit (per settings; default true).

### Services & Endpoints
- Convex HTTP endpoint: `POST /polar/webhook` (in `convex/http.ts`)
  - Verify signature; parse events; upsert user by `external_id`; credit account; write `payments` with idempotency.
- Convex mutation/action: `createCheckoutSession` (server-only)
  - Calls Polar `POST /v1/checkouts/` with product/price IDs; returns `client_secret` to client.
  - Prefills Polar checkout with `customer_email` and `customer_name` from the signed-in Clerk user for clarity.
- Optional Next.js route `/api/polar/checkout` (server action alternative) if preferred outside Convex.

- Admin settings (reactive):
  - `admin.getBillingSettings` (query) and `admin.updateBillingSettings` (mutation, admin-only)
  - UI in `/app/admin` to edit pack price, credits per pack, refund toggle, free trial credits.

### Products & Pricing
- Create a single Polar product/price for a $5 one-time purchase.
- Map credits from `billingSettings.creditsPerPack` (admin-controlled; default 420). If quantity > 1, grant `creditsPerPack * quantity`.
- Config via env:
  - `POLAR_ACCESS_TOKEN` (OAT)
  - `POLAR_ENV` = `sandbox` | `production`
  - `POLAR_PRODUCT_ID` or `POLAR_PRICE_ID`
  - `POLAR_WEBHOOK_SECRET`

## Implementation Phases

### Phase 1 — Foundations (Sandbox)
1. Polar setup
   - Create sandbox OAT and product/price (one-time $5). Note IDs.
   - Configure webhook endpoint URL and secret for sandbox.
2. Convex schema
   - Add `users`, `payments`, and `billingSettings` tables with indexes.
   - Add helper `getOrCreateUser(userId)`.
   - Seed default `billingSettings` row: `{ packPriceCents: 500, creditsPerPack: 420, refundOnFailure: true, freeTrialCredits: 10 }`.
3. Checkout session creation
   - Server mutation `payments.createCheckoutSession({ quantity?: number })` → Polar `POST /v1/checkouts/` with `customer.external_id`.
   - Prefill `customer_email` and `customer_name` from Clerk.
   - Return `client_secret`.
4. Client flow
   - Add “Buy credits” UI: calls server mutation, receives `client_secret`, confirms session on client.
5. Webhook
   - Add `POST /polar/webhook` in `convex/http.ts`.
   - Verify signature; on `order.updated` with `status` paid/complete, grant `billingSettings.creditsPerPack * quantity` credits and insert `payments` row (idempotent by `orderId`).
   - Persist `amountCents` from Polar; do not rely on settings for monetary values.

### Phase 2 — Generation Gating
1. Require auth in `uploadAndScheduleGeneration`.
2. Atomically check and decrement credits in the same mutation before scheduling generation.
3. On final failure in `generate.ts`, if `billingSettings.refundOnFailure` is true (default), refund 1 credit and record refund reason in `payments` or a `credits_ledger` (optional future table).

### Phase 3 — UX & Admin
1. Show credit balance in header/menu.
2. If 0 credits, disable generation CTA and surface purchase modal/redirect.
3. Admin view: `billingSettings` editor; `payments` list; user credit adjustments (optional).

## Testing & Verification
- Use Polar sandbox throughout.
- Unit tests for:
  - Webhook idempotency (same `orderId` processed once).
  - Credit decrement atomicity under concurrency (Convex mutation).
  - Upload/generation blocked with 0 credits.
  - Optional refund on final failure path.
- Manual E2E:
  - Purchase $5 pack with test cards → credits increase → generation allowed.
  - Two simultaneous generations with 1 remaining credit → only one schedules.

## Security Considerations
- Never expose OAT to client; server-only.
- Verify webhook signatures (`POLAR_WEBHOOK_SECRET`).
- Use `external_id` (Clerk subject) as authoritative mapping; also persist `polarCustomerId` if present.
- Handle PII minimally; store only needed fields.
- Rate-limit checkout session creation.

## Decisions
- $5 pack grants 420 credits (admin-editable).
- Always refund a credit on final generation failure (admin-toggle, default true).
- Free trial: grant 10 credits on first account creation.

## References
- Polar API Overview: https://polar.sh/docs/api-reference/introduction
- Checkout Sessions: https://polar.sh/docs/api-reference/checkouts/create-session
- Confirm from Client: https://polar.sh/docs/api-reference/checkouts/confirm-session-from-client
- Orders Webhook (`order.updated`): https://polar.sh/docs/api-reference/webhooks/order.updated
