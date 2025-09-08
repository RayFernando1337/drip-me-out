import { httpRouter } from "convex/server";
import { api, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

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
    try {
      // 1) Store file in Convex storage
      const blob = await request.blob();
      const storageId = await ctx.storage.store(blob);

      // 2) Create original image in DB with pending and schedule processing
      const originalImageId = await ctx.runMutation(api.generate.scheduleImageGeneration, {
        storageId,
      });

      // 3) Respond with IDs for client reference
      return new Response(JSON.stringify({ storageId, originalImageId }), {
        status: 200,
        headers: new Headers({
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          Vary: "origin",
        }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: new Headers({
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          Vary: "origin",
        }),
      });
    }
  }),
});

export default http;
