"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { requireIdentity } from "../lib/auth";
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
    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Polar checkout creation failed: ${message}`);
    }
  },
});
