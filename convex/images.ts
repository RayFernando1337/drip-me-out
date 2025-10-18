import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";
import { assertOwner, requireIdentity } from "./lib/auth";
import { mapImagesToUrls } from "./lib/images";
import { getOrCreateUser } from "./lib/users";
import { PaginatedGalleryValidator } from "./lib/validators";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Consolidated upload mutation - replaces scheduleImageGeneration
export const uploadAndScheduleGeneration = mutation({
  args: {
    storageId: v.id("_storage"),
    originalWidth: v.number(),
    originalHeight: v.number(),
    contentType: v.string(),
    placeholderBlurDataUrl: v.optional(v.string()),
    originalSizeBytes: v.optional(v.number()),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    const { storageId, originalWidth, originalHeight, contentType: declaredContentType } = args;

    // Require authentication
    const identity = await requireIdentity(ctx);
    const userId = identity.subject;

    // Get or create user and check credits
    const user = await getOrCreateUser(ctx, userId);
    if (user.credits < 1) {
      throw new Error(
        "INSUFFICIENT_CREDITS: You need at least 1 credit to generate an image. Please purchase credits to continue."
      );
    }

    // Validate file metadata (size/type) before consuming credits
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new Error("VALIDATION: Missing storage metadata");

    const allowed = new Set(["image/webp", "image/jpeg", "image/png", "image/heic", "image/heif"]);
    const storageContentType: string | undefined = (meta as { contentType?: string }).contentType;
    const size: number | undefined = (meta as { size?: number }).size;

    if (!storageContentType || !allowed.has(storageContentType)) {
      throw new Error("VALIDATION: Unsupported content type");
    }
    if (typeof size === "number" && size > 3 * 1024 * 1024) {
      throw new Error("VALIDATION: File exceeds 3 MB limit");
    }

    if (storageContentType !== declaredContentType) {
      console.warn("[uploadAndScheduleGeneration] Content type mismatch", {
        storageContentType,
        declaredContentType,
        storageId,
      });
    }

    const sanitizedWidth = Number.isFinite(originalWidth)
      ? Math.max(1, Math.round(originalWidth))
      : null;
    const sanitizedHeight = Number.isFinite(originalHeight)
      ? Math.max(1, Math.round(originalHeight))
      : null;
    if (!sanitizedWidth || !sanitizedHeight) {
      throw new Error("VALIDATION: Invalid image dimensions");
    }

    const placeholderBlurDataUrl = args.placeholderBlurDataUrl?.length
      ? args.placeholderBlurDataUrl
      : undefined;
    if (placeholderBlurDataUrl && placeholderBlurDataUrl.length > 10_000) {
      throw new Error("VALIDATION: Blur placeholder too large");
    }

    const originalSizeBytes =
      typeof size === "number"
        ? size
        : args.originalSizeBytes && Number.isFinite(args.originalSizeBytes)
          ? Math.max(0, Math.round(args.originalSizeBytes))
          : undefined;

    const contentType = storageContentType;

    // Atomically decrement credits BEFORE scheduling generation
    await ctx.db.patch(user._id, {
      credits: user.credits - 1,
      updatedAt: Date.now(),
    });

    // Create the original image record with pending status
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending" as const,
      generationAttempts: 0,
      // Ownership + public gallery defaults
      userId,
      isFeatured: false,
      isDisabledByAdmin: false,
      contentType,
      originalWidth: sanitizedWidth,
      originalHeight: sanitizedHeight,
      originalSizeBytes,
      placeholderBlurDataUrl,
    });

    // Schedule the image generation immediately
    await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
      storageId,
      originalImageId,
      contentType,
    });

    return originalImageId;
  },
});

// Public featured gallery (unauthenticated)
export const getPublicGallery = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: PaginatedGalleryValidator,
  handler: async (ctx, args) => {
    // Exclude admin-disabled items using compound index
    const result = await ctx.db
      .query("images")
      .withIndex("by_isFeatured_and_isDisabledByAdmin_and_featuredAt", (q) =>
        q.eq("isFeatured", true).eq("isDisabledByAdmin", false)
      )
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

// Toggle featured status (owner only)
export const updateFeaturedStatus = mutation({
  args: {
    imageId: v.id("images"),
    isFeatured: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    // Backward-compat: older images may not have userId set.
    // If missing, claim ownership to the current user before proceeding.
    const identity = await requireIdentity(ctx);
    if (!image.userId) {
      await ctx.db.patch(args.imageId, { userId: identity.subject });
    } else {
      await assertOwner(ctx, image.userId);
    }

    if (image.isDisabledByAdmin && args.isFeatured) {
      const reason = image.disabledByAdminReason?.trim();
      throw new Error(
        reason
          ? `This image was removed by a moderator: ${reason}`
          : "This image was removed by a moderator. Contact support to request reinstatement."
      );
    }

    await ctx.db.patch(args.imageId, {
      isFeatured: args.isFeatured,
      featuredAt: args.isFeatured ? Date.now() : undefined,
      // Ensure isDisabledByAdmin is explicitly set for compound index queries
      isDisabledByAdmin: image.isDisabledByAdmin ?? false,
    });
    return null;
  },
});

export const sendImage = mutation({
  args: {
    storageId: v.id("_storage"),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.id("images")),
    contentType: v.optional(v.string()),
    originalWidth: v.optional(v.number()),
    originalHeight: v.optional(v.number()),
    placeholderBlurDataUrl: v.optional(v.string()),
    originalSizeBytes: v.optional(v.number()),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    const sanitizedWidth =
      typeof args.originalWidth === "number" && Number.isFinite(args.originalWidth)
        ? Math.max(1, Math.round(args.originalWidth))
        : undefined;
    const sanitizedHeight =
      typeof args.originalHeight === "number" && Number.isFinite(args.originalHeight)
        ? Math.max(1, Math.round(args.originalHeight))
        : undefined;
    const sanitizedPlaceholder =
      args.placeholderBlurDataUrl && args.placeholderBlurDataUrl.length <= 10_000
        ? args.placeholderBlurDataUrl
        : undefined;
    const sanitizedSize =
      typeof args.originalSizeBytes === "number" && Number.isFinite(args.originalSizeBytes)
        ? Math.max(0, Math.round(args.originalSizeBytes))
        : undefined;

    return await ctx.db.insert("images", {
      body: args.storageId,
      createdAt: Date.now(),
      isGenerated: args.isGenerated,
      originalImageId: args.originalImageId,
      contentType: args.contentType,
      originalWidth: sanitizedWidth,
      originalHeight: sanitizedHeight,
      placeholderBlurDataUrl: sanitizedPlaceholder,
      originalSizeBytes: sanitizedSize,
    });
  },
});

export const deleteImage = mutation({
  args: {
    imageId: v.id("images"),
    includeGenerated: v.optional(v.boolean()),
  },
  returns: v.object({
    deletedTotal: v.number(),
    deletedGenerated: v.number(),
    actedAsAdmin: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) {
      return { deletedTotal: 0, deletedGenerated: 0, actedAsAdmin: false };
    }

    const identity = await requireIdentity(ctx);
    const adminRecord = await ctx.db
      .query("admins")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .unique();
    const actedAsAdmin = !!adminRecord;

    if (!actedAsAdmin) {
      if (!image.userId) {
        await ctx.db.patch(args.imageId, { userId: identity.subject });
      } else if (image.userId !== identity.subject) {
        throw new Error("Not authorized to modify this image");
      }
    }

    const includeGenerated = args.includeGenerated ?? true;
    const docsToDelete: Array<typeof image> = [image];

    if (includeGenerated && image.isGenerated !== true) {
      const generatedDocs = await ctx.db
        .query("images")
        .withIndex("by_originalImageId", (q) => q.eq("originalImageId", args.imageId))
        .collect();
      docsToDelete.push(...generatedDocs);
    }

    const seenIds = new Set<string>();
    const uniqueDocs: Array<typeof image> = [];
    for (const doc of docsToDelete) {
      if (seenIds.has(doc._id)) continue;
      seenIds.add(doc._id);
      uniqueDocs.push(doc);
    }

    let deletedGenerated = 0;

    for (const doc of uniqueDocs) {
      if (doc._id !== image._id && doc.isGenerated === true) {
        deletedGenerated += 1;
      }

      try {
        await ctx.storage.delete(doc.body);
      } catch (error) {
        console.warn("[deleteImage] Failed to delete storage blob", {
          imageId: doc._id,
          storageId: doc.body,
          error,
        });
      }

      try {
        await ctx.db.delete(doc._id);
      } catch (error) {
        console.warn("[deleteImage] Failed to delete image document", {
          imageId: doc._id,
          error,
        });
      }
    }

    return {
      deletedTotal: uniqueDocs.length,
      deletedGenerated,
      actedAsAdmin,
    };
  },
});

// OPTIMIZED: Get gallery images using proper indexes (no filters)
export const getGalleryImages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("images"),
      _creationTime: v.number(),
      body: v.id("_storage"),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.id("images")),
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
      // Optional public gallery + ownership fields
      userId: v.optional(v.string()),
      isFeatured: v.optional(v.boolean()),
      featuredAt: v.optional(v.number()),
      isDisabledByAdmin: v.optional(v.boolean()),
      disabledByAdminAt: v.optional(v.number()),
      disabledByAdminReason: v.optional(v.string()),
      url: v.string(),
    })
  ),
  handler: async (ctx) => {
    // Use indexes instead of filters for performance

    // 1. Get all generated images (completed transformations)
    const generatedImages = await ctx.db
      .query("images")
      .withIndex("by_is_generated", (q) => q.eq("isGenerated", true))
      .order("desc")
      .collect();

    // 2. Get pending originals (placeholders)
    const pendingImages = await ctx.db
      .query("images")
      .withIndex("by_is_generated_and_status", (q) =>
        q.eq("isGenerated", false).eq("generationStatus", "pending")
      )
      .order("desc")
      .collect();

    // 3. Get processing originals (placeholders)
    const processingImages = await ctx.db
      .query("images")
      .withIndex("by_is_generated_and_status", (q) =>
        q.eq("isGenerated", false).eq("generationStatus", "processing")
      )
      .order("desc")
      .collect();

    // Combine and sort by creation time
    const allGalleryImages = [...generatedImages, ...pendingImages, ...processingImages].sort(
      (a, b) => b._creationTime - a._creationTime
    );

    // OPTIMIZATION: Batch URL generation for better performance
    const storageIds = allGalleryImages.map((img) => img.body);
    const urls = await Promise.all(storageIds.map((id) => ctx.storage.getUrl(id)));

    // Map URLs back to images efficiently
    const imagesWithUrls = allGalleryImages.map((image, index) => ({
      ...image,
      url: urls[index],
    }));

    // Filter out images without URLs and assert type
    return imagesWithUrls.filter(
      (image): image is typeof image & { url: string } => image.url !== null
    );
  },
});

// OPTIMIZED: Get failed images using proper index (no filters)
export const getFailedImages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("images"),
    })
  ),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    // Scope to current user and filter locally for failed originals
    const userImages = await ctx.db
      .query("images")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();

    const failedOriginals = userImages.filter(
      (img) => img.isGenerated !== true && img.generationStatus === "failed"
    );

    return failedOriginals.map((img) => ({ _id: img._id }));
  },
});

// OPTIMIZED: Check if any generation is active using proper indexes
export const hasActiveGenerations = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    // Check pending/processing for current user only using user-scoped index
    const [pendingOne, processingOne] = await Promise.all([
      ctx.db
        .query("images")
        .withIndex("by_userId_and_generationStatus", (q) =>
          q.eq("userId", identity.subject).eq("generationStatus", "pending")
        )
        .take(1),
      ctx.db
        .query("images")
        .withIndex("by_userId_and_generationStatus", (q) =>
          q.eq("userId", identity.subject).eq("generationStatus", "processing")
        )
        .take(1),
    ]);

    return pendingOne.length > 0 || processingOne.length > 0;
  },
});

// OPTIMIZED: Fast paginated gallery using proper indexing strategy
export const getGalleryImagesPaginated = query({
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
        isGenerated: v.optional(v.boolean()),
        originalImageId: v.optional(v.id("images")),
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
        userId: v.optional(v.string()),
        isFeatured: v.optional(v.boolean()),
        featuredAt: v.optional(v.number()),
        isDisabledByAdmin: v.optional(v.boolean()),
        disabledByAdminAt: v.optional(v.number()),
        disabledByAdminReason: v.optional(v.string()),
        url: v.string(),
      })
    ),
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    // Fetch per-user, ordered by createdAt, and overfetch to account for filtering
    const adjustedPaginationOpts = {
      ...args.paginationOpts,
      numItems: Math.ceil(args.paginationOpts.numItems * 1.5),
    };

    const result = await ctx.db
      .query("images")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .paginate(adjustedPaginationOpts);

    // Efficiently filter for gallery items (avoid expensive operations)
    const galleryImages: typeof result.page = [];

    for (const img of result.page) {
      if (img.isGenerated === true) {
        galleryImages.push(img);
        continue;
      }
      const status = img.generationStatus;
      if (status === "pending" || status === "processing") {
        galleryImages.push(img);
      }
    }

    const trimmedGalleryImages = galleryImages.slice(0, args.paginationOpts.numItems);

    if (trimmedGalleryImages.length === 0) {
      return {
        page: [],
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    const storageIds = trimmedGalleryImages.map((img) => img.body);
    const urls = await Promise.all(storageIds.map((id) => ctx.storage.getUrl(id)));

    const imagesWithUrls = trimmedGalleryImages.map((image, index) => ({
      ...image,
      url: urls[index],
    }));

    const validImages = imagesWithUrls.filter(
      (image): image is typeof image & { url: string } => image.url !== null
    );

    const actuallyDone = result.isDone && validImages.length < args.paginationOpts.numItems;

    return {
      page: validImages,
      isDone: actuallyDone,
      continueCursor: result.continueCursor,
    };
  },
});

// OPTIMIZED: Get total count using index-based approach
export const getGalleryImagesCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    // Count only the current user's images
    const userImages = await ctx.db
      .query("images")
      .withIndex("by_userId", (q) => q.eq("userId", identity.subject))
      .collect();

    let generated = 0;
    let pending = 0;
    let processing = 0;
    for (const img of userImages) {
      if (img.isGenerated === true) generated += 1;
      else if (img.generationStatus === "pending") pending += 1;
      else if (img.generationStatus === "processing") processing += 1;
    }

    return generated + pending + processing;
  },
});

// Legacy function for backward compatibility - same as getGalleryImages
export const getImages = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("images"),
      _creationTime: v.number(),
      body: v.id("_storage"),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.id("images")),
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
      userId: v.optional(v.string()),
      isFeatured: v.optional(v.boolean()),
      featuredAt: v.optional(v.number()),
      isDisabledByAdmin: v.optional(v.boolean()),
      disabledByAdminAt: v.optional(v.number()),
      disabledByAdminReason: v.optional(v.string()),
      url: v.string(),
    })
  ),
  handler: async (ctx) => {
    // Get all images ordered by creation time (newest first)
    const images = await ctx.db.query("images").order("desc").collect();

    // Filter for gallery display:
    // - Include originals that are pending/processing (placeholders)
    // - Include all generated images (completed results)
    // - Exclude failed originals (these go in failed tab only)
    const galleryImages = images.filter((img) => {
      if (img.isGenerated) {
        return true; // Show all generated images
      }
      // For originals, only show pending/processing (not failed)
      return img.generationStatus === "pending" || img.generationStatus === "processing";
    });

    // Generate URLs for each image
    const imagesWithUrls = await Promise.all(
      galleryImages.map(async (image) => {
        const url = await ctx.storage.getUrl(image.body);
        return {
          ...image,
          url,
        };
      })
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
      body: v.id("_storage"),
      createdAt: v.number(),
      isGenerated: v.optional(v.boolean()),
      originalImageId: v.optional(v.id("images")),
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
      userId: v.optional(v.string()),
      isFeatured: v.optional(v.boolean()),
      featuredAt: v.optional(v.number()),
      isDisabledByAdmin: v.optional(v.boolean()),
      disabledByAdminAt: v.optional(v.number()),
      disabledByAdminReason: v.optional(v.string()),
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

// Moved from generate.ts: status update for originals
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

    const existing = await ctx.db.get(imageId);
    if (!existing) {
      return null;
    }

    const updateData: {
      generationStatus: "pending" | "processing" | "completed" | "failed";
      generationError?: string;
    } = { generationStatus: status };
    if (error) {
      updateData.generationError = error;
    }

    await ctx.db.patch(imageId, updateData);
    return null;
  },
});

// Moved from generate.ts: persist generated image record
export const saveGeneratedImage = mutation({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
    contentType: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    placeholderBlurDataUrl: v.optional(v.string()),
    sizeBytes: v.optional(v.number()),
  },
  returns: v.union(v.id("images"), v.null()),
  handler: async (ctx, args) => {
    const {
      storageId,
      originalImageId,
      contentType,
      width,
      height,
      placeholderBlurDataUrl,
      sizeBytes,
    } = args;
    const originalImage = await ctx.db.get(originalImageId);
    if (!originalImage) {
      try {
        await ctx.storage.delete(storageId);
      } catch (error) {
        console.warn("[saveGeneratedImage] Failed to delete orphaned storage", {
          storageId,
          error,
        });
      }
      return null;
    }

    const sanitizedWidth =
      typeof width === "number" && Number.isFinite(width)
        ? Math.max(1, Math.round(width))
        : undefined;
    const sanitizedHeight =
      typeof height === "number" && Number.isFinite(height)
        ? Math.max(1, Math.round(height))
        : undefined;
    const sanitizedPlaceholder =
      placeholderBlurDataUrl && placeholderBlurDataUrl.length <= 10_000
        ? placeholderBlurDataUrl
        : undefined;
    const sanitizedSize =
      typeof sizeBytes === "number" && Number.isFinite(sizeBytes)
        ? Math.max(0, Math.round(sizeBytes))
        : undefined;

    const generatedImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: true,
      originalImageId: originalImageId,
      userId: originalImage.userId,
      sharingEnabled: originalImage.sharingEnabled,
      shareExpiresAt: originalImage.shareExpiresAt,
      contentType,
      originalWidth: sanitizedWidth,
      originalHeight: sanitizedHeight,
      placeholderBlurDataUrl: sanitizedPlaceholder,
      originalSizeBytes: sanitizedSize,
    });
    return generatedImageId;
  },
});

// Moved from generate.ts: auto-retry toggle
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
      const contentType: string | undefined = (meta as { contentType?: string } | null)
        ?.contentType;
      await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
        storageId,
        originalImageId: imageId,
        contentType,
      });
      return true;
    }
    return false;
  },
});

// Moved from generate.ts: manual retry
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
    await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
      storageId,
      originalImageId: imageId,
      contentType,
    });
    return null;
  },
});

// New internal query for refund logic (minimal shape)
export const getImageUserForRefund = internalQuery({
  args: { imageId: v.id("images") },
  returns: v.union(
    v.object({
      _id: v.id("images"),
      userId: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, { imageId }) => {
    const image = await ctx.db.get(imageId);
    if (!image) return null;
    return { _id: image._id, userId: image.userId };
  },
});
