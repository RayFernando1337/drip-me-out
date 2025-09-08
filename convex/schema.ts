import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  images: defineTable({
    body: v.id("_storage"), // Storage ID for the image file
    createdAt: v.number(),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.id("images")), // Reference to original image
    generationStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
    generationError: v.optional(v.string()),
    generationAttempts: v.optional(v.number()), // counts auto/manual attempts
    // New fields for sharing
    sharingEnabled: v.optional(v.boolean()),
    shareExpiresAt: v.optional(v.number()),
  })
    .index("by_is_generated", ["isGenerated"])
    .index("by_generation_status", ["generationStatus"])
    .index("by_is_generated_and_status", ["isGenerated", "generationStatus"]) // Compound index for filtering
    .index("by_sharing_enabled", ["sharingEnabled"]),
});
