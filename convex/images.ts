import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const createImage = mutation({
  args: {
    storageId: v.id("_storage"),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.id("images")),
    generationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("images", {
      storageId: args.storageId,
      createdAt: Date.now(),
      isGenerated: args.isGenerated,
      originalImageId: args.originalImageId,
      generationStatus: args.generationStatus,
    });
  },
});

export const getImages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("images"),
      _creationTime: v.number(),
      storageId: v.id("_storage"),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.id("images")),
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
      url: v.string(),
    })
  ),
  handler: async (ctx) => {
    const images = await ctx.db.query("images").order("desc").collect();

    // Generate URLs for each image, handling both old and new field names
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => {
        // Handle migration: use storageId if available, fallback to body
        const storageId = image.storageId || (image as any).body;
        if (!storageId) {
          console.warn(`Image ${image._id} has no storageId or body field`);
          return null;
        }
        
        const url = await ctx.storage.getUrl(storageId);
        return {
          ...image,
          storageId: storageId,
          url: url,
        };
      })
    );

    // Filter out images without URLs and assert type
    return imagesWithUrls.filter(
      (image): image is typeof image & { url: string } => image !== null && image.url !== null
    );
  },
});

export const getImageById = query({
  args: { imageId: v.id("images") },
  returns: v.union(
    v.object({
      _id: v.id("images"),
      _creationTime: v.number(),
      storageId: v.id("_storage"),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.id("images")),
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
      url: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) return null;

    // Check if sharing is enabled (default to true for backward compatibility)
    const sharingEnabled = image.sharingEnabled !== false;
    if (!sharingEnabled) return null;

    // Check expiration
    if (image.shareExpiresAt && image.shareExpiresAt < Date.now()) {
      return null;
    }

    // Handle migration: use storageId if available, fallback to body
    const storageId = image.storageId || (image as any).body;
    if (!storageId) return null;
    
    const url = await ctx.storage.getUrl(storageId);
    if (!url) return null;

    return {
      ...image,
      storageId: storageId,
      url,
    };
  },
});

export const updateShareSettings = mutation({
  args: {
    imageId: v.id("images"),
    sharingEnabled: v.boolean(),
    expirationHours: v.optional(v.number()), // 24, 168 (7d), 720 (30d), null (never)
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { imageId, sharingEnabled, expirationHours } = args;

    const updateData: { sharingEnabled: boolean; shareExpiresAt?: number } = { sharingEnabled };

    if (expirationHours !== undefined) {
      if (expirationHours === null || expirationHours === 0) {
        updateData.shareExpiresAt = undefined;
      } else {
        updateData.shareExpiresAt = Date.now() + expirationHours * 60 * 60 * 1000;
      }
    }

    await ctx.db.patch(imageId, updateData);
    return null;
  },
});
