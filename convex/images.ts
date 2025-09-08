import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

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

    // Create the original image record with pending status
    const originalImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: false,
      generationStatus: "pending" as const,
      generationAttempts: 0,
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

// Get all images for gallery display (pending/processing originals + completed generated)
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

// Get failed images for the Failed tab
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
    // Get failed originals only
    const failedImages = await ctx.db
      .query("images")
      .withIndex("by_is_generated_and_status")
      .filter((q) =>
        q.and(q.eq(q.field("isGenerated"), false), q.eq(q.field("generationStatus"), "failed"))
      )
      .order("desc")
      .collect();

    // Generate URLs for each image
    const imagesWithUrls = await Promise.all(
      failedImages.map(async (image) => {
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

// Check if any generation is active
export const hasActiveGenerations = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const activeCount = await ctx.db
      .query("images")
      .withIndex("by_generation_status")
      .filter((q) =>
        q.or(
          q.eq(q.field("generationStatus"), "pending"),
          q.eq(q.field("generationStatus"), "processing")
        )
      )
      .collect();

    return activeCount.length > 0;
  },
});

// Paginated gallery images for performance optimization
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
    // Get paginated images ordered by creation time (newest first)
    const result = await ctx.db.query("images").order("desc").paginate(args.paginationOpts);

    // Filter for gallery display:
    // - Include originals that are pending/processing (placeholders)
    // - Include all generated images (completed results)
    // - Exclude failed originals (these go in failed tab only)
    const filteredImages = result.page.filter((img) => {
      if (img.isGenerated) {
        return true; // Show all generated images
      }
      // For originals, only show pending/processing (not failed)
      return img.generationStatus === "pending" || img.generationStatus === "processing";
    });

    // Generate URLs for each image
    const imagesWithUrls = await Promise.all(
      filteredImages.map(async (image) => {
        const url = await ctx.storage.getUrl(image.body);
        return {
          ...image,
          url,
        };
      })
    );

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

// Get total count of gallery images for pagination info
export const getGalleryImagesCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const images = await ctx.db.query("images").collect();

    // Count gallery images (same filter as above)
    const galleryImages = images.filter((img) => {
      if (img.isGenerated) {
        return true; // Count all generated images
      }
      // For originals, only count pending/processing (not failed)
      return img.generationStatus === "pending" || img.generationStatus === "processing";
    });

    return galleryImages.length;
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
