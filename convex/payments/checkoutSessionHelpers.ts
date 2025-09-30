import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "../lib/auth";
import { internal } from "../_generated/api";

// Public mutation: initiates checkout session creation
export const initiateCheckout = mutation({
  args: {
    successUrl: v.optional(v.string()),
    embedOrigin: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
  },
  returns: v.id("checkoutSessions"),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    // Create pending checkout session record
    const sessionId = await ctx.db.insert("checkoutSessions", {
      userId: identity.subject,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule background action to call Polar API
    await ctx.scheduler.runAfter(0, internal.payments.createCheckoutSession.processCheckout, {
      sessionId,
      successUrl: args.successUrl,
      embedOrigin: args.embedOrigin,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
    });

    return sessionId;
  },
});

// Internal query: get session for action
export const getSessionInternal = internalQuery({
  args: { sessionId: v.id("checkoutSessions") },
  returns: v.union(
    v.object({
      _id: v.id("checkoutSessions"),
      userId: v.string(),
      status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;
    return {
      _id: session._id,
      userId: session.userId,
      status: session.status,
      createdAt: session.createdAt,
    };
  },
});

// Internal mutation: update checkout session
export const updateCheckoutSession = internalMutation({
  args: {
    sessionId: v.id("checkoutSessions"),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
    clientSecret: v.optional(v.string()),
    checkoutId: v.optional(v.string()),
    url: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { sessionId, status, ...rest } = args;
    await ctx.db.patch(sessionId, {
      status,
      completedAt: Date.now(),
      ...rest,
    });
    return null;
  },
});

// Public query: get checkout session status (for client polling)
export const getCheckoutSession = query({
  args: { sessionId: v.id("checkoutSessions") },
  returns: v.union(
    v.object({
      status: v.union(v.literal("pending"), v.literal("completed"), v.literal("failed")),
      clientSecret: v.optional(v.string()),
      url: v.optional(v.string()),
      checkoutId: v.optional(v.string()),
      error: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    // Verify caller owns this session
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || identity.subject !== session.userId) {
      return null;
    }

    return {
      status: session.status,
      clientSecret: session.clientSecret,
      url: session.url,
      checkoutId: session.checkoutId,
      error: session.error,
    };
  },
});