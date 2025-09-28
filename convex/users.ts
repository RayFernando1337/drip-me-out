import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";
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
    
    // Check if user is still in free trial period (7 days from account creation)
    const freeTrialDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const hasFreeTrial = user.createdAt > Date.now() - freeTrialDuration;
    
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
    const { getEffectiveBillingSettings } = await import("./lib/billing");
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
    console.log(`[refundCredits] Refunded 1 credit to user ${userId} for image ${imageId}. Reason: ${reason || 'generation failure'}`);
    
    return { refunded: true, newBalance };
  },
});
