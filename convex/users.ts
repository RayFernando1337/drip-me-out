import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";
import { getEffectiveBillingSettings } from "./lib/billing";
import { getOrCreateUser, getUserById } from "./lib/users";

export const ensureUser = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    await getOrCreateUser(ctx, identity.subject);
    return null;
  },
});

export const upsertFromClerkWebhook = internalMutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await getOrCreateUser(ctx, args.userId);
    return null;
  },
});

export const getCurrentUserCredits = query({
  args: {},
  returns: v.object({
    credits: v.number(),
    hasFreeTrial: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const user = await getUserById(ctx, identity.subject);

    // If user doesn't exist yet, return default values
    // The user will be created when they first upload an image
    if (!user) {
      return {
        credits: 0,
        hasFreeTrial: true,
      };
    }

    // Check if user is still in free trial period
    // Free trial ends when: (1) 7 days have passed OR (2) user has made any purchase
    const freeTrialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const timeBasedTrialExpired = user.createdAt <= Date.now() - freeTrialDuration;

    // Check if user has made any purchases (which ends free trial immediately)
    const hasMadePurchase = await ctx.db
      .query("payments")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .first();

    const hasFreeTrial = !timeBasedTrialExpired && !hasMadePurchase;

    return {
      credits: user.credits,
      hasFreeTrial,
    };
  },
});

export const refundCreditsForFailedGeneration = mutation({
  args: {
    userId: v.string(),
    imageId: v.id("images"),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    refunded: v.boolean(),
    newBalance: v.number(),
  }),
  handler: async (ctx, args) => {
    const { userId, imageId, reason } = args;

    // Check billing settings to see if refunds are enabled
    const settings = await getEffectiveBillingSettings(ctx);

    if (!settings.refundOnFailure) {
      return { refunded: false, newBalance: 0 };
    }

    // Get user and refund 1 credit
    const user = await getUserById(ctx, userId);
    if (!user) {
      return { refunded: false, newBalance: 0 };
    }

    const newBalance = user.credits + 1;
    await ctx.db.patch(user._id, {
      credits: newBalance,
      updatedAt: Date.now(),
    });

    // Log the refund reason (could be used for analytics)
    console.log(
      `[refundCredits] Refunded 1 credit to user ${userId} for image ${imageId}. Reason: ${reason || "generation failure"}`
    );

    return { refunded: true, newBalance };
  },
});
