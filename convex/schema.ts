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

    // New fields for public gallery + ownership
    userId: v.optional(v.string()), // Clerk user ID (owner)
    isFeatured: v.optional(v.boolean()), // Public gallery toggle
    featuredAt: v.optional(v.number()), // When marked featured
    isDisabledByAdmin: v.optional(v.boolean()), // Admin moderation
    disabledByAdminAt: v.optional(v.number()),
    disabledByAdminReason: v.optional(v.string()),
  })
    .index("by_is_generated", ["isGenerated"])
    .index("by_generation_status", ["generationStatus"])
    .index("by_is_generated_and_status", ["isGenerated", "generationStatus"]) // Compound index for filtering
    .index("by_sharing_enabled", ["sharingEnabled"]) // link sharing controls
    // New indexes for public featured gallery
    .index("by_userId", ["userId"]) // find by owner
    .index("by_isFeatured", ["isFeatured"]) // basic featured flag
    .index("by_isFeatured_and_featuredAt", ["isFeatured", "featuredAt"]) // sort by featured date
    .index("by_isFeatured_and_isDisabledByAdmin_and_featuredAt", [
      "isFeatured",
      "isDisabledByAdmin",
      "featuredAt",
    ]),
  admins: defineTable({
    userId: v.string(), // Clerk subject
    createdAt: v.number(),
  }).index("by_userId", ["userId"]),
});
