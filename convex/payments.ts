import { action, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "./lib/auth";
import { getOrCreateUser } from "./lib/users";
import { getEffectiveBillingSettings } from "./lib/billing";
import { Polar } from "@polar-sh/sdk";

function polarServer(): "sandbox" | "production" {
  const env = (process.env.POLAR_ENV || "sandbox").toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

export const createCheckoutSession = action({
  args: {
    successUrl: v.optional(v.string()),
    embedOrigin: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    // future: quantity support; v1 will sell a single credit pack per checkout
  },
  returns: v.object({ clientSecret: v.string(), checkoutId: v.string(), url: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const token = process.env.POLAR_ACCESS_TOKEN;
    const productId = process.env.POLAR_PRODUCT_ID;
    if (!token || !productId) {
      throw new Error("POLAR configuration missing: POLAR_ACCESS_TOKEN and POLAR_PRODUCT_ID are required");
    }

    const polar = new Polar({ accessToken: token, server: polarServer() });
    const checkout = await polar.checkouts.create({
      products: [productId],
      externalCustomerId: identity.subject,
      successUrl: args.successUrl,
      embedOrigin: args.embedOrigin,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      metadata: { userId: identity.subject, app: "drip-me-out" },
    });

    return {
      clientSecret: checkout.clientSecret,
      checkoutId: checkout.id,
      url: checkout.url,
    };
  },
});

export const processPaidOrder = mutation({
  args: {
    orderId: v.string(),
    externalUserId: v.string(),
    amountCents: v.number(),
    polarCustomerId: v.optional(v.string()),
    quantity: v.optional(v.number()),
  },
  returns: v.object({ granted: v.number(), skipped: v.boolean() }),
  handler: async (ctx, args) => {
    const { orderId, externalUserId, amountCents, polarCustomerId } = args;

    // Idempotency: check if this order was already processed
    const existingPayment = await ctx.db
      .query("payments")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .unique();
    if (existingPayment) {
      return { granted: 0, skipped: true };
    }

    // Ensure user exists (grants free trial on first creation)
    const user = await getOrCreateUser(ctx, externalUserId);
    const settings = await getEffectiveBillingSettings(ctx);
    const qty = Math.max(1, Math.floor(args.quantity ?? 1));
    const creditsToGrant = settings.creditsPerPack * qty;

    // Upsert user credit balance and polar customer link if missing
    const updatedCredits = (user?.credits ?? 0) + creditsToGrant;
    await ctx.db.patch(user._id, {
      credits: updatedCredits,
      updatedAt: Date.now(),
      ...(user.polarCustomerId ? {} : polarCustomerId ? { polarCustomerId } : {}),
    });

    await ctx.db.insert("payments", {
      orderId,
      userId: externalUserId,
      amountCents,
      creditsGranted: creditsToGrant,
      status: "paid",
      createdAt: Date.now(),
    });

    return { granted: creditsToGrant, skipped: false };
  },
});
