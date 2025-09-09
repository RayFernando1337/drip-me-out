import { v } from "convex/values";

export const GalleryItemValidator = v.object({
  _id: v.id("images"),
  _creationTime: v.number(),
  body: v.id("_storage"),
  createdAt: v.number(),
  url: v.string(),
  userId: v.optional(v.string()),
  isFeatured: v.optional(v.boolean()),
});

export const PaginatedGalleryValidator = v.object({
  page: v.array(GalleryItemValidator),
  isDone: v.boolean(),
  continueCursor: v.union(v.string(), v.null()),
});

