export { createCheckoutSession } from "./payments/createCheckoutSession";

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser } from "./lib/users";
import { getEffectiveBillingSettings } from "./lib/billing";

export const processPaidOrder = mutation({
  args: {
    orderId: v.string(),
    externalUserId: v.string(),
    amountCents: v.number(),
    polarCustomerId: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  returns: v.object({ granted: v.number(), skipped: v.boolean() }),
  handler: async (ctx, args) => {
    const { orderId, externalUserId, amountCents, polarCustomerId } = args;

    // Idempotency: check if this order was already processed
    const existingPayment = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .unique();
    if (existingPayment) {
      return { granted: 0, skipped: true };
    }

    // Ensure user exists (grants free trial on first creation)
    const user = await getOrCreateUser(ctx, externalUserId);
    const settings = await getEffectiveBillingSettings(ctx);
    const qty = Math.max(1, Math.floor(args.quantity ?? 1));
    const creditsToGrant = settings.creditsPerPack * qty;

    // Upsert user credit balance and polar customer link if missing
    const updatedCredits = (user?.credits ?? 0) + creditsToGrant;
    await ctx.db.patch(user._id, {
      credits: updatedCredits,
      updatedAt: Date.now(),
      ...(user.polarCustomerId ? {} : polarCustomerId ? { polarCustomerId } : {}),
    });

    await ctx.db.insert("payments", {
      orderId,
      userId: externalUserId,
      amountCents,
      creditsGranted: creditsToGrant,
      status: "paid",
      createdAt: Date.now(),
    });

    return { granted: creditsToGrant, skipped: false };
  },
});
