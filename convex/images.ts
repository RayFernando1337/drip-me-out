import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { mapImagesToUrls } from "./lib/images";
import { assertOwner } from "./lib/auth";
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

    // Track user via existing Clerk auth
    const identity = await ctx.auth.getUserIdentity();
    const userId = identity?.subject; // Clerk user ID

    // Create the original image record with pending status
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending" as const,
      generationAttempts: 0,
      // Add user tracking fields
      userId, // Track Clerk user ID
      isFeatured: false, // Default to not featured
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

export const sendImage = mutation({
  args: {
    storageId: v.id("_storage"),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.id("images")),
  },
  returns: v.id("images"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("images", {
      body: args.storageId,
      createdAt: Date.now(),
      isGenerated: args.isGenerated,
      originalImageId: args.originalImageId,
    });
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
      _creationTime: v.number(),
      body: v.id("_storage"),
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
    // Use proper index for failed originals only
    const failedImages = await ctx.db
      .query("images")
      .withIndex("by_is_generated_and_status", (q) =>
        q.eq("isGenerated", false).eq("generationStatus", "failed")
      )
      .order("desc")
      .collect();

    // OPTIMIZATION: Batch URL generation for better performance
    const storageIds = failedImages.map((img) => img.body);
    const urls = await Promise.all(storageIds.map((id) => ctx.storage.getUrl(id)));

    // Map URLs back to images efficiently
    const imagesWithUrls = failedImages.map((image, index) => ({
      ...image,
      url: urls[index],
    }));

    // Filter out images without URLs and assert type
    return imagesWithUrls.filter(
      (image): image is typeof image & { url: string } => image.url !== null
    );
  },
});

// OPTIMIZED: Check if any generation is active using proper indexes
export const hasActiveGenerations = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    // Use separate index queries instead of filters
    const pendingCount = await ctx.db
      .query("images")
      .withIndex("by_generation_status", (q) => q.eq("generationStatus", "pending"))
      .take(1);

    if (pendingCount.length > 0) return true;

    const processingCount = await ctx.db
      .query("images")
      .withIndex("by_generation_status", (q) => q.eq("generationStatus", "processing"))
      .take(1);

    return processingCount.length > 0;
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
    isDone: v.boolean(),
    continueCursor: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    // STRATEGY: Use the default order (by _creationTime desc) and leverage Post-Processing
    // This is faster than complex index combinations for mixed queries
    const result = await ctx.db.query("images").order("desc").paginate(args.paginationOpts);

    // Efficiently filter for gallery items (avoid expensive operations)
    const galleryImages: typeof result.page = [];

    for (const img of result.page) {
      // Include all generated images (completed transformations)
      if (img.isGenerated === true) {
        galleryImages.push(img);
        continue;
      }

      // Include only pending/processing originals (placeholders)
      const status = img.generationStatus;
      if (status === "pending" || status === "processing") {
        galleryImages.push(img);
      }
      // Skip failed originals (they go to failed tab)
    }

    // OPTIMIZATION: Batch URL generation for filtered gallery images
    if (galleryImages.length === 0) {
      return {
        page: [],
        isDone: result.isDone,
        continueCursor: result.continueCursor,
      };
    }

    const storageIds = galleryImages.map((img) => img.body);
    const urls = await Promise.all(storageIds.map((id) => ctx.storage.getUrl(id)));

    // Map URLs back to images efficiently
    const imagesWithUrls = galleryImages.map((image, index) => ({
      ...image,
      url: urls[index],
    }));

    // Filter out images without URLs and assert type
    const validImages = imagesWithUrls.filter(
      (image): image is typeof image & { url: string } => image.url !== null
    );

    return {
      page: validImages,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// OPTIMIZED: Get total count using index-based approach
export const getGalleryImagesCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    // Count each category using indexes for better performance
    const [generatedImages, pendingImages, processingImages] = await Promise.all([
      // All generated images
      ctx.db
        .query("images")
        .withIndex("by_is_generated", (q) => q.eq("isGenerated", true))
        .collect(),

      // Pending originals
      ctx.db
        .query("images")
        .withIndex("by_is_generated_and_status", (q) =>
          q.eq("isGenerated", false).eq("generationStatus", "pending")
        )
        .collect(),

      // Processing originals
      ctx.db
        .query("images")
        .withIndex("by_is_generated_and_status", (q) =>
          q.eq("isGenerated", false).eq("generationStatus", "processing")
        )
        .collect(),
    ]);

    return generatedImages.length + pendingImages.length + processingImages.length;
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

// Public gallery query for unauthenticated users
export const getPublicGallery = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: PaginatedGalleryValidator,
  handler: async (ctx, args) => {
    // Use index-based query (no .filter() per Convex rules)
    const result = await ctx.db
      .query("images")
      .withIndex(
        "by_isFeatured_and_isDisabledByAdmin_and_featuredAt",
        (q) => q.eq("isFeatured", true).eq("isDisabledByAdmin", false)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    // Batch URL generation via helper
    const imagesWithUrls = await mapImagesToUrls(ctx, result.page);
    return {
      page: imagesWithUrls,
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// Update featured status for user's images
export const updateFeaturedStatus = mutation({
  args: {
    imageId: v.id("images"),
    isFeatured: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) throw new Error("Image not found");
    
    // Check ownership using centralized auth helper
    await assertOwner(ctx, image.userId);

    // Update featured status
    await ctx.db.patch(args.imageId, {
      isFeatured: args.isFeatured,
      featuredAt: args.isFeatured ? Date.now() : undefined,
    });
    return null;
  },
});
