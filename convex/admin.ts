import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Minimal admin assertion using Clerk publicMetadata
async function assertAdmin(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity || identity.publicMetadata?.isAdmin !== true) {
    throw new Error("Not authorized - admin only");
  }
  return identity;
}

export const disableFeaturedImage = mutation({
  args: {
    imageId: v.id("images"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
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
    await assertAdmin(ctx);
    await ctx.db.patch(args.imageId, {
      isDisabledByAdmin: false,
      disabledByAdminAt: undefined,
      disabledByAdminReason: undefined,
    });
    return null;
  },
});

export const getAdminFeaturedImages = query({
  args: { paginationOpts: paginationOptsValidator },
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
    await assertAdmin(ctx);
    const result = await ctx.db
      .query("images")
      .withIndex("by_isFeatured_and_featuredAt", (q) => q.eq("isFeatured", true))
      .order("desc")
      .paginate(args.paginationOpts);

    if (result.page.length === 0) {
      return { page: [], isDone: result.isDone, continueCursor: result.continueCursor };
    }

    const urls = await Promise.all(result.page.map((d) => ctx.storage.getUrl(d.body)));
    const withUrls = result.page
      .map((d, i) => (urls[i] ? { ...d, url: urls[i] as string } : null))
      .filter((x): x is typeof result.page[number] & { url: string } => x !== null);

    return {
      page: withUrls,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

