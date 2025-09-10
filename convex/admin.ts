import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { requireIdentity } from "./lib/auth";
import { mapImagesToUrls } from "./lib/images";

// Reactive admin utilities
export const getAdminStatus = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    return !!existing;
  },
});

export const grantAdmin = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const identity = await requireIdentity(ctx);
    const callerIsAdmin = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!callerIsAdmin) throw new Error("Not authorized - admin only");
    const exists = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!exists) {
      await ctx.db.insert("admins", { userId, createdAt: Date.now() });
    }
    return null;
  },
});

export const revokeAdmin = mutation({
  args: { userId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const identity = await requireIdentity(ctx);
    const callerIsAdmin = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!callerIsAdmin) throw new Error("Not authorized - admin only");
    const exists = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (exists) {
      const { _id } = exists as { _id: Id<"admins"> };
      await ctx.db.delete(_id);
    }
    return null;
  },
});

// One-time bootstrap to create the first admin without requiring auth
// Behavior:
// - If no rows exist in `admins`, insert the provided userId
// - If there is already at least one admin, this is a no-op (returns created: false)
export const bootstrapAdmin = mutation({
  args: { userId: v.string() },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, { userId }) => {
    // Check if any admin exists
    const first = await ctx.db.query("admins").take(1);
    if (first.length === 0) {
      await ctx.db.insert("admins", { userId, createdAt: Date.now() });
      return { created: true };
    }
    return { created: false };
  },
});

export const disableFeaturedImage = mutation({
  args: {
    imageId: v.id("images"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const callerIsAdmin = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!callerIsAdmin) throw new Error("Not authorized - admin only");
    await ctx.db.patch(args.imageId, {
      isDisabledByAdmin: true,
      disabledByAdminAt: Date.now(),
      disabledByAdminReason: args.reason,
    });
    return null;
  },
});

export const enableFeaturedImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const callerIsAdmin = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!callerIsAdmin) throw new Error("Not authorized - admin only");
    await ctx.db.patch(args.imageId, {
      isDisabledByAdmin: false,
      disabledByAdminAt: undefined,
      disabledByAdminReason: undefined,
    });
    return null;
  },
});

// Optional maintenance: normalize featured flags for legacy data
export const normalizeFeaturedFlags = mutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const callerIsAdmin = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!callerIsAdmin) throw new Error("Not authorized - admin only");
    let updated = 0;
    const batch = await ctx.db
      .query("images")
      .withIndex("by_isFeatured", (q) => q.eq("isFeatured", true))
      .collect();
    for (const img of batch) {
      if (img.isDisabledByAdmin === undefined) {
        await ctx.db.patch(img._id, { isDisabledByAdmin: false });
        updated++;
      }
    }
    return updated;
  },
});

export const getAdminFeaturedImages = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(
      v.object({
        _id: v.id("images"),
        _creationTime: v.number(),
        body: v.id("_storage"),
        createdAt: v.number(),
        url: v.string(),
        userId: v.optional(v.string()),
        isFeatured: v.optional(v.boolean()),
        isDisabledByAdmin: v.optional(v.boolean()),
        disabledByAdminReason: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const callerIsAdmin = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    if (!callerIsAdmin) throw new Error("Not authorized - admin only");
    const result = await ctx.db
      .query("images")
      .withIndex("by_isFeatured_and_featuredAt", (q) => q.eq("isFeatured", true))
      .order("desc")
      .paginate(args.paginationOpts);

    const imagesWithUrls = await mapImagesToUrls(ctx, result.page);
    return {
      page: imagesWithUrls,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});
