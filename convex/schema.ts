import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  images: defineTable({
    body: v.id("_storage"), // Storage ID for the image file
    createdAt: v.number(),
    isGenerated: v.optional(v.boolean()),
    originalImageId: v.optional(v.id("images")), // Reference to original image
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
    .index("by_originalImageId", ["originalImageId"])
    .index("by_generation_status", ["generationStatus"])
    .index("by_is_generated_and_status", ["isGenerated", "generationStatus"]) // Compound index for filtering
    .index("by_sharing_enabled", ["sharingEnabled"]) // link sharing controls
    // New indexes for public featured gallery
    .index("by_userId", ["userId"]) // find by owner
    // User-scoped indexes for efficient queries
    .index("by_userId_and_createdAt", ["userId", "createdAt"]) // per-user feed ordering
    .index("by_userId_and_isGenerated_and_createdAt", ["userId", "isGenerated", "createdAt"]) // efficient gallery filtering
    .index("by_userId_and_generationStatus", ["userId", "generationStatus"]) // fast status checks per user
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

  // Users table to track credit balances and Polar linkage
  users: defineTable({
    userId: v.string(), // Clerk subject (owner)
    credits: v.number(), // available generation credits
    polarCustomerId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"]) // fast lookups by subject
    .index("by_polarCustomerId", ["polarCustomerId"]),

  // Payments table for idempotent order processing & audit
  payments: defineTable({
    orderId: v.string(), // Polar order id
    userId: v.string(), // Clerk subject
    amountCents: v.number(),
    creditsGranted: v.number(),
    status: v.union(v.literal("paid"), v.literal("refunded"), v.literal("failed")),
    createdAt: v.number(),
  })
    .index("by_orderId", ["orderId"]) // ensure idempotency
    .index("by_userId", ["userId"]),

  // Admin-editable singleton for billing configuration
  billingSettings: defineTable({
    packPriceCents: v.number(), // e.g., 500
    creditsPerPack: v.number(), // e.g., 420
    refundOnFailure: v.boolean(), // default true
    freeTrialCredits: v.number(), // e.g., 10
    updatedAt: v.number(),
    updatedBy: v.string(), // admin userId
  }),

  // Checkout sessions for async Polar checkout creation
  checkoutSessions: defineTable({
    userId: v.string(), // Clerk subject
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    clientSecret: v.optional(v.string()), // Polar client secret when completed
    url: v.optional(v.string()), // Polar hosted checkout URL when completed
    checkoutId: v.optional(v.string()), // Polar checkout ID when completed
    error: v.optional(v.string()), // Error message if failed
    createdAt: v.number(),
    completedAt: v.optional(v.number()), // When action finished (success or fail)
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),
});
