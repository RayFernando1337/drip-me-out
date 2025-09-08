import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const sendImage = mutation({
  args: {
    storageId: v.id("_storage"),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.string()),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    // Legacy endpoint kept for compatibility; route all new uploads through scheduleImageGeneration.
    const id = await ctx.db.insert("images", {
      body: args.storageId,
      createdAt: Date.now(),
      isGenerated: args.isGenerated,
      originalImageId: args.originalImageId,
    });
    return id;
  },
});

export const getImages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("images"),
      _creationTime: v.number(),
      body: v.string(),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.string()),
      generationStatus: v.optional(v.string()),
      generationError: v.optional(v.string()),
      generationAttempts: v.optional(v.number()),
      sharingEnabled: v.optional(v.boolean()),
      shareExpiresAt: v.optional(v.number()),
      url: v.string(),
    })
  ),
  handler: async (ctx) => {
    const images = await ctx.db.query("images").order("desc").collect();

    // Generate URLs for each image
    const imagesWithUrls = await Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await ctx.storage.getUrl(image.body),
      }))
    );

    // Filter out images without URLs and assert type
    return imagesWithUrls.filter(
      (image): image is typeof image & { url: string } => image.url !== null
    );
  },
});

export const getImageById = query({
  args: { imageId: v.id("images") },
  returns: v.union(
    v.object({
      _id: v.id("images"),
      _creationTime: v.number(),
      body: v.string(),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.string()),
      generationStatus: v.optional(v.string()),
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

    const url = await ctx.storage.getUrl(image.body);
    if (!url) return null;

    return {
      ...image,
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

// ---- Generation pipeline mutations (moved from generate.ts to keep Node actions separate) ----

export const updateImageStatus = mutation({
  args: {
    imageId: v.id("images"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { imageId, status, error } = args;
    const updateData: {
      generationStatus: "pending" | "processing" | "completed" | "failed";
      generationError?: string;
    } = { generationStatus: status };
    if (error) updateData.generationError = error;
    await ctx.db.patch(imageId, updateData);
    return null;
  },
});

export const saveGeneratedImage = mutation({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    const { storageId, originalImageId } = args;
    const generatedImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: true,
      originalImageId,
    });
    return generatedImageId;
  },
});

export const scheduleImageGeneration = mutation({
  args: { storageId: v.id("_storage") },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    const { storageId } = args;
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new Error("VALIDATION: Missing storage metadata");
    const allowed = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
    const contentType: string | undefined = (meta as { contentType?: string }).contentType;
    const size: number | undefined = (meta as { size?: number }).size;
    if (!contentType || !allowed.has(contentType)) {
      throw new Error("VALIDATION: Unsupported content type");
    }
    if (typeof size === "number" && size > 5 * 1024 * 1024) {
      throw new Error("VALIDATION: File exceeds 5 MB limit");
    }
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending",
      generationAttempts: 0,
    });
    await ctx.scheduler.runAfter(0, (internal as any).generateAction.generateImage, {
      storageId,
      originalImageId,
      contentType,
    });
    return originalImageId;
  },
});

export const maybeRetryOnce = mutation({
  args: { imageId: v.id("images") },
  returns: v.boolean(),
  handler: async (ctx, { imageId }) => {
    const img = await ctx.db.get(imageId);
    if (!img || img.isGenerated) return false;
    const attempts = (img.generationAttempts ?? 0) + 1;
    await ctx.db.patch(imageId, { generationAttempts: attempts });
    if (attempts <= 1) {
      await ctx.db.patch(imageId, { generationStatus: "pending", generationError: undefined });
      const storageId = img.body as unknown as Id<"_storage">;
      const meta = await ctx.db.system.get(storageId);
      const contentType: string | undefined = (meta as { contentType?: string } | null)?.contentType;
      await ctx.scheduler.runAfter(0, (internal as any).generateAction.generateImage, {
        storageId,
        originalImageId: imageId,
        contentType,
      });
      return true;
    }
    return false;
  },
});

export const retryOriginal = mutation({
  args: { imageId: v.id("images") },
  returns: v.null(),
  handler: async (ctx, { imageId }) => {
    const img = await ctx.db.get(imageId);
    if (!img || img.isGenerated) return null;
    await ctx.db.patch(imageId, { generationStatus: "pending", generationError: undefined });
    const storageId = img.body as unknown as Id<"_storage">;
    const meta = await ctx.db.system.get(storageId);
    const contentType: string | undefined = (meta as { contentType?: string } | null)?.contentType;
    await ctx.scheduler.runAfter(0, (internal as any).generateAction.generateImage, {
      storageId,
      originalImageId: imageId,
      contentType,
    });
    return null;
  },
});
