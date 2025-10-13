"use node";

import { Polar } from "@polar-sh/sdk";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";

function polarServer(): "sandbox" | "production" {
  const env = (process.env.POLAR_ENV || "sandbox").toLowerCase();
  return env === "production" ? "production" : "sandbox";
}

// Internal action: processes Polar API call in background
export const processCheckout = internalAction({
  args: {
    sessionId: v.id("checkoutSessions"),
    successUrl: v.optional(v.string()),
    embedOrigin: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const token = process.env.POLAR_ACCESS_TOKEN;
    const productId = process.env.POLAR_PRODUCT_ID;

    // Get session to verify it exists and get userId
    const session = await ctx.runQuery(
      internal.payments.checkoutSessionHelpers.getSessionInternal,
      {
        sessionId: args.sessionId,
      }
    );

    if (!session) {
      console.error("[processCheckout] Session not found:", args.sessionId);
      return null;
    }

    if (session.status !== "pending") {
      console.warn("[processCheckout] Session already processed:", args.sessionId);
      return null;
    }

    if (!token || !productId) {
      await ctx.runMutation(internal.payments.checkoutSessionHelpers.updateCheckoutSession, {
        sessionId: args.sessionId,
        status: "failed",
        error: "POLAR configuration missing: POLAR_ACCESS_TOKEN and POLAR_PRODUCT_ID are required",
      });
      return null;
    }

    const polar = new Polar({ accessToken: token, server: polarServer() });
    try {
      const checkout = await polar.checkouts.create({
        products: [productId],
        externalCustomerId: session.userId,
        successUrl: args.successUrl,
        embedOrigin: args.embedOrigin,
        customerEmail: args.customerEmail,
        customerName: args.customerName,
        metadata: { userId: session.userId, app: "animeleak" },
      });

      // Update session with success
      await ctx.runMutation(internal.payments.checkoutSessionHelpers.updateCheckoutSession, {
        sessionId: args.sessionId,
        status: "completed",
        clientSecret: checkout.clientSecret,
        checkoutId: checkout.id,
        url: checkout.url,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.payments.checkoutSessionHelpers.updateCheckoutSession, {
        sessionId: args.sessionId,
        status: "failed",
        error: `Polar checkout creation failed: ${message}`,
      });
    }
    return null;
  },
});
