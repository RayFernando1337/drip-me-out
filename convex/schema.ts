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
    // Fields for sharing
    sharingEnabled: v.optional(v.boolean()),
    shareExpiresAt: v.optional(v.number()),
    // Fields for user tracking and public gallery
    userId: v.optional(v.string()), // Track Clerk user ID who uploaded the image
    isFeatured: v.optional(v.boolean()), // Simple toggle for public gallery
    featuredAt: v.optional(v.number()), // Timestamp when marked as featured
    isDisabledByAdmin: v.optional(v.boolean()), // Admin can disable inappropriate featured images
    disabledByAdminAt: v.optional(v.number()), // Timestamp when disabled by admin
    disabledByAdminReason: v.optional(v.string()), // Reason for admin disable
  })
    .index("by_is_generated", ["isGenerated"])
    .index("by_generation_status", ["generationStatus"])
    .index("by_is_generated_and_status", ["isGenerated", "generationStatus"]) // Compound index for filtering
    .index("by_sharing_enabled", ["sharingEnabled"])
    // New indexes for public gallery functionality
    .index("by_userId", ["userId"]) // Find images by user
    .index("by_isFeatured", ["isFeatured"]) // Find featured images
    .index("by_isFeatured_and_featuredAt", ["isFeatured", "featuredAt"]) // Featured images by date
    .index(
      "by_isFeatured_and_isDisabledByAdmin_and_featuredAt",
      ["isFeatured", "isDisabledByAdmin", "featuredAt"]
    ), // Public query: eq featured + eq not disabled + order by featuredAt
});
