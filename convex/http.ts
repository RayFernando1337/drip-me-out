import { httpRouter } from "convex/server";
import {
  Webhook as StandardWebhook,
  WebhookVerificationError as StandardWebhookVerificationError,
} from "standardwebhooks";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa is available in Convex's V8 runtime
  return btoa(binary);
}

// Pre-flight request for /sendImage
http.route({
  path: "/sendImage",
  method: "OPTIONS",
  handler: httpAction(async (_, request) => {
    // Make sure the necessary headers are present
    // for this to be a valid pre-flight request
    const headers = request.headers;
    if (
      headers.get("Origin") !== null &&
      headers.get("Access-Control-Request-Method") !== null &&
      headers.get("Access-Control-Request-Headers") !== null
    ) {
      return new Response(null, {
        headers: new Headers({
          // e.g. https://mywebsite.com, configured on your Convex dashboard
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST",
          "Access-Control-Allow-Headers": "Content-Type, Digest",
          "Access-Control-Max-Age": "86400",
        }),
      });
    } else {
      return new Response();
    }
  }),
});

http.route({
  path: "/sendImage",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Step 1: Store the file
    const blob = await request.blob();
    const storageId = await ctx.storage.store(blob);

    // Step 2: Save the storage ID to the database via a mutation
    await ctx.runMutation(api.images.sendImage, { storageId });

    // Step 3: Return a response with the correct CORS headers
    return new Response(null, {
      status: 200,
      // CORS headers
      headers: new Headers({
        // e.g. https://mywebsite.com, configured on your Convex dashboard
        "Access-Control-Allow-Origin": "*",
        Vary: "origin",
      }),
    });
  }),
});

export default http;

// Polar order events for one-time credit packs (order.paid / order.updated)
http.route({
  path: "/polar/orders",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.POLAR_WEBHOOK_SECRET;
    if (!secret) return new Response("Server configuration error", { status: 500 });

    const body = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
    const base64Secret = typeof btoa === "function" ? toBase64Utf8(secret) : secret;

    let event: { type?: string; data?: Record<string, unknown> };
    try {
      const webhook = new StandardWebhook(base64Secret);
      event = webhook.verify(body, headers) as { type?: string; data?: Record<string, unknown> };
    } catch (err) {
      if (err instanceof StandardWebhookVerificationError)
        return new Response("Forbidden", { status: 403 });
      return new Response("Bad request", { status: 400 });
    }

    try {
      if (event.type === "order.paid" || event.type === "order.updated") {
        const d = event.data as {
          id?: string;
          status?: string;
          paid?: boolean;
          total_amount?: number;
          customer?: { external_id?: string; id?: string };
        };
        const isPaid = d?.paid === true || d?.status === "paid";
        if (isPaid) {
          const orderId = d?.id;
          const externalUserId = d?.customer?.external_id;
          const polarCustomerId = d?.customer?.id;
          const amountCents = Number(d?.total_amount ?? 0);
          if (!orderId || !externalUserId) return new Response("Accepted", { status: 202 });
          await ctx.runMutation(api.payments.processPaidOrder, {
            orderId,
            externalUserId,
            amountCents,
            polarCustomerId,
            quantity: 1,
          });
        }
      }
      return new Response("", { status: 202 });
    } catch {
      return new Response("Internal server error", { status: 500 });
    }
  }),
});
