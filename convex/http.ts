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

// REMOVED: /sendImage endpoint - was bypassing credit checks and allowing free generations
// All image uploads should go through the authenticated generateUploadUrl + uploadAndScheduleGeneration flow

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
          metadata?: { userId?: string; app?: string };
        };
        const isPaid = d?.paid === true || d?.status === "paid";
        if (isPaid) {
          const orderId = d?.id;
          // Try external_id first, fallback to metadata.userId
          const externalUserId = d?.customer?.external_id || d?.metadata?.userId;
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
