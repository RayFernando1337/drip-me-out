import { v } from "convex/values";

export const GalleryItemValidator = v.object({
  _id: v.id("images"),
  _creationTime: v.number(),
  body: v.id("_storage"),
  createdAt: v.number(),
  url: v.string(),
  userId: v.optional(v.string()),
  isFeatured: v.optional(v.boolean()),
  featuredAt: v.optional(v.number()),
  isGenerated: v.optional(v.boolean()),
  originalImageId: v.optional(v.id("images")),
  contentType: v.optional(v.string()),
  originalWidth: v.optional(v.number()),
  originalHeight: v.optional(v.number()),
  originalSizeBytes: v.optional(v.number()),
  placeholderBlurDataUrl: v.optional(v.string()),
  // Admin moderation flags may be present on documents
  isDisabledByAdmin: v.optional(v.boolean()),
  disabledByAdminAt: v.optional(v.number()),
  disabledByAdminReason: v.optional(v.string()),
});

export const PaginatedGalleryValidator = v.object({
  page: v.array(GalleryItemValidator),
  isDone: v.boolean(),
  continueCursor: v.union(v.string(), v.null()),
});
