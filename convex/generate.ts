import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Update image generation status
 */
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

    const updateData: Partial<Doc<"images">> = { generationStatus: status };
    if (error) {
      updateData.generationError = error;
    }

    await ctx.db.patch(imageId, updateData);
    return null;
  },
});

/**
 * Save generated image
 */
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
      originalImageId: originalImageId,
    });
    return generatedImageId;
  },
});

/**
 * Schedule image generation (call this from your upload functions)
 */
export const scheduleImageGeneration = mutation({
  args: {
    storageId: v.id("_storage"),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    const { storageId } = args;

    // Validate file metadata (size/type) before inserting
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

    // First, save the original image with pending status
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending",
      generationAttempts: 0,
    });

    // Schedule the image generation to run immediately, passing through the validated contentType
    await ctx.scheduler.runAfter(0, (internal as any).generateAction.generateImage, {
      storageId,
      originalImageId,
      contentType,
    });

    return originalImageId;
  },
});

// Auto-retry once when generation fails.
export const maybeRetryOnce = mutation({
  args: { imageId: v.id("images") },
  returns: v.boolean(),
  handler: async (ctx, { imageId }) => {
    const img = await ctx.db.get(imageId);
    if (!img || img.isGenerated) return false;
    const attempts = (img.generationAttempts ?? 0) + 1;
    await ctx.db.patch(imageId, { generationAttempts: attempts });
    if (attempts <= 1) {
      // Reset to pending and clear error before retry
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

// Manual retry from UI
export const retryOriginal = mutation({
  args: { imageId: v.id("images") },
  returns: v.null(),
  handler: async (ctx, { imageId }) => {
    const img = await ctx.db.get(imageId);
    if (!img || img.isGenerated) return null;
    // Reset status and error; do not modify attempts here (manual retries not limited)
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
