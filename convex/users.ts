import { v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireIdentity } from "./lib/auth";
import { getOrCreateUser } from "./lib/users";

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
