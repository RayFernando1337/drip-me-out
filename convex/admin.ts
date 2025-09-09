import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdmin } from "./lib/auth";
import { mapImagesToUrls } from "./lib/images";
import { PaginatedAdminGalleryValidator } from "./lib/validators";

export const disableFeaturedImage = mutation({
  args: {
    imageId: v.id("images"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertAdmin(ctx); // DRY auth check
    
    // Same patch pattern as existing updateShareSettings
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
    await assertAdmin(ctx); // DRY auth check
    
    // Same patch pattern as existing mutations
    await ctx.db.patch(args.imageId, {
      isDisabledByAdmin: false,
      disabledByAdminAt: undefined,
      disabledByAdminReason: undefined,
    });
    return null;
  },
});

export const getAdminFeaturedImages = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: PaginatedAdminGalleryValidator,
  handler: async (ctx, args) => {
    await assertAdmin(ctx); // DRY auth check
    
    // Same query pattern as getPublicGallery
    const result = await ctx.db
      .query("images")
      .withIndex("by_isFeatured_and_featuredAt", (q) => q.eq("isFeatured", true))
      .order("desc")
      .paginate(args.paginationOpts);

    // Same batch URL generation pattern
    const imagesWithUrls = await mapImagesToUrls(ctx, result.page);

    return {
      page: imagesWithUrls,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});