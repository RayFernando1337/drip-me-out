import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  images: defineTable({
    // Support both old and new field names during migration
    storageId: v.optional(v.id("_storage")), // New field
    body: v.optional(v.string()), // Legacy field - will be removed after migration
    createdAt: v.number(),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.id("images")), // Proper ID type for references
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
    // Sharing fields
    sharingEnabled: v.optional(v.boolean()),
    shareExpiresAt: v.optional(v.number()),
  })
    .index("by_created_at", ["createdAt"])
    .index("by_is_generated", ["isGenerated"]) 
    .index("by_generation_status", ["generationStatus"]) 
    .index("by_sharing_enabled", ["sharingEnabled"])
    .index("by_original_image", ["originalImageId"]), // Index for finding generated images by original
});
