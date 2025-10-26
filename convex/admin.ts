import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { assertAdmin, requireIdentity } from "./lib/auth";
import { getEffectiveBillingSettings } from "./lib/billing";
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
        featuredAt: v.optional(v.number()),
        url: v.string(),
        userId: v.optional(v.string()),
        isFeatured: v.optional(v.boolean()),
        isDisabledByAdmin: v.optional(v.boolean()),
        disabledByAdminReason: v.optional(v.string()),
        // extra fields that may be present on images
        isGenerated: v.optional(v.boolean()),
        originalImageId: v.optional(v.id("images")),
        disabledByAdminAt: v.optional(v.number()),
        // New schema fields added for WebP support
        contentType: v.optional(v.string()),
        originalWidth: v.optional(v.number()),
        originalHeight: v.optional(v.number()),
        originalSizeBytes: v.optional(v.number()),
        placeholderBlurDataUrl: v.optional(v.string()),
        generationStatus: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
          )
        ),
        generationError: v.optional(v.string()),
        generationAttempts: v.optional(v.number()),
        sharingEnabled: v.optional(v.boolean()),
        shareExpiresAt: v.optional(v.number()),
        // Admin review workflow fields
        featureRequestedAt: v.optional(v.number()),
        featureApprovedAt: v.optional(v.number()),
        featureApprovedBy: v.optional(v.string()),
        featureRejectedAt: v.optional(v.number()),
        featureRejectedBy: v.optional(v.string()),
        featureRejectionReason: v.optional(v.string()),
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

// Approve a pending featured image (admin only)
export const approveFeaturedImage = mutation({
  args: {
    imageId: v.id("images"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const identity = await requireIdentity(ctx);

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    if (!image.isFeatured) throw new Error("Image not marked for featuring");
    if (image.featureApprovedAt) throw new Error("Already approved");

    await ctx.db.patch(args.imageId, {
      featureApprovedAt: Date.now(),
      featureApprovedBy: identity.subject,
      featuredAt: Date.now(), // Public gallery sorts by this
      // Clear rejection fields if previously rejected
      featureRejectedAt: undefined,
      featureRejectedBy: undefined,
      featureRejectionReason: undefined,
    });
    return null;
  },
});

// Reject a pending featured image (admin only)
export const rejectFeaturedImage = mutation({
  args: {
    imageId: v.id("images"),
    reason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);
    const identity = await requireIdentity(ctx);

    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    if (!image.isFeatured) throw new Error("Image not marked for featuring");

    await ctx.db.patch(args.imageId, {
      isFeatured: false, // Remove feature flag
      featureRejectedAt: Date.now(),
      featureRejectedBy: identity.subject,
      featureRejectionReason: args.reason.trim(),
      // Clear approval fields
      featureApprovedAt: undefined,
      featureApprovedBy: undefined,
      featureRequestedAt: undefined,
      featuredAt: undefined,
    });
    return null;
  },
});

// Query for pending featured images awaiting admin approval
export const getPendingFeaturedImages = query({
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
        featuredAt: v.optional(v.number()),
        url: v.string(),
        userId: v.optional(v.string()),
        isFeatured: v.optional(v.boolean()),
        isDisabledByAdmin: v.optional(v.boolean()),
        disabledByAdminReason: v.optional(v.string()),
        // extra fields that may be present on images
        isGenerated: v.optional(v.boolean()),
        originalImageId: v.optional(v.id("images")),
        disabledByAdminAt: v.optional(v.number()),
        // New schema fields added for WebP support
        contentType: v.optional(v.string()),
        originalWidth: v.optional(v.number()),
        originalHeight: v.optional(v.number()),
        originalSizeBytes: v.optional(v.number()),
        placeholderBlurDataUrl: v.optional(v.string()),
        generationStatus: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("processing"),
            v.literal("completed"),
            v.literal("failed")
          )
        ),
        generationError: v.optional(v.string()),
        generationAttempts: v.optional(v.number()),
        sharingEnabled: v.optional(v.boolean()),
        shareExpiresAt: v.optional(v.number()),
        // Admin review workflow fields
        featureRequestedAt: v.optional(v.number()),
        featureApprovedAt: v.optional(v.number()),
        featureApprovedBy: v.optional(v.string()),
        featureRejectedAt: v.optional(v.number()),
        featureRejectedBy: v.optional(v.string()),
        featureRejectionReason: v.optional(v.string()),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await assertAdmin(ctx);

    // Query images where isFeatured=true but not yet approved
    const result = await ctx.db
      .query("images")
      .withIndex("by_isFeatured_and_featureRequestedAt", (q) => q.eq("isFeatured", true))
      .filter((q) => q.eq(q.field("featureApprovedAt"), undefined))
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

// One-time migration: backfill featureApprovedAt for legacy featured images
export const backfillFeaturedApprovals = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {

    // Find all featured images without approval timestamp
    const featured = await ctx.db
      .query("images")
      .withIndex("by_isFeatured", (q) => q.eq("isFeatured", true))
      .filter((q) => q.eq(q.field("featureApprovedAt"), undefined))
      .collect();

    for (const img of featured) {
      await ctx.db.patch(img._id, {
        featureApprovedAt: img.featuredAt ?? img.createdAt,
        featureApprovedBy: "SYSTEM_MIGRATION",
        featureRequestedAt: img.featuredAt ?? img.createdAt,
      });
    }

    return featured.length;
  },
});

// Admin billing settings (reactive)
export const getBillingSettings = query({
  args: {},
  returns: v.object({
    packPriceCents: v.number(),
    creditsPerPack: v.number(),
    refundOnFailure: v.boolean(),
    freeTrialCredits: v.number(),
    updatedAt: v.union(v.number(), v.null()),
    updatedBy: v.union(v.string(), v.null()),
    isDefault: v.boolean(),
  }),
  handler: async (ctx) => {
    // Only admins may view/edit billing settings (to keep it simple)
    await assertAdmin(ctx);
    const settings = await ctx.db.query("billingSettings").take(1);
    if (settings.length === 0) {
      const eff = await getEffectiveBillingSettings(ctx);
      return {
        ...eff,
        updatedAt: null,
        updatedBy: null,
        isDefault: true,
      };
    }
    const s = settings[0] as Doc<"billingSettings">;
    return {
      packPriceCents: s.packPriceCents,
      creditsPerPack: s.creditsPerPack,
      refundOnFailure: s.refundOnFailure,
      freeTrialCredits: s.freeTrialCredits,
      updatedAt: s.updatedAt ?? null,
      updatedBy: s.updatedBy ?? null,
      isDefault: false,
    };
  },
});

export const updateBillingSettings = mutation({
  args: {
    packPriceCents: v.number(),
    creditsPerPack: v.number(),
    refundOnFailure: v.boolean(),
    freeTrialCredits: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await assertAdmin(ctx);
    const now = Date.now();
    const existing = await ctx.db.query("billingSettings").take(1);
    if (existing.length === 0) {
      await ctx.db.insert("billingSettings", {
        ...args,
        updatedAt: now,
        updatedBy: identity.subject,
      });
    } else {
      const existingSettings = existing[0] as Doc<"billingSettings">;
      await ctx.db.patch(existingSettings._id, {
        ...args,
        updatedAt: now,
        updatedBy: identity.subject,
      });
    }
    return null;
  },
});
