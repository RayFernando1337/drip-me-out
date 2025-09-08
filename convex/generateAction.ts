"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { GoogleGenAI } from "@google/genai";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const buf = Buffer.from(base64, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export const generateImage = internalAction({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
    contentType: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { storageId, originalImageId, contentType } = args;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "failed",
        error: "API key not configured",
      });
      return null;
    }

    try {
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "processing",
      });

      const ai = new GoogleGenAI({ apiKey });
      const baseImageUrl = await ctx.storage.getUrl(storageId);
      if (!baseImageUrl) {
        throw new Error("Failed to get image URL from storage");
      }
      const response = await fetch(baseImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch uploaded image from storage: ${response.statusText}`);
      }
      const headerType = response.headers.get("content-type") || undefined;
      const mimeType = contentType || headerType || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      const base64Image = arrayBufferToBase64(arrayBuffer);

      const contents = [
        { text: "Add diamond chains and stylize strongly as whimsical anime." },
        { inlineData: { mimeType, data: base64Image } },
      ];

      const genResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents,
      });

      const candidates = genResponse.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("Gemini returned no candidates");
      }
      let b64Out: string | null = null;
      const parts: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }>
        = candidates[0].content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          b64Out = part.inlineData.data;
          break;
        }
      }
      if (!b64Out) {
        throw new Error("Gemini response did not include image data");
      }

      const imageBuffer = base64ToUint8Array(b64Out);
      const imageBlob = new Blob([imageBuffer as BlobPart], { type: "image/png" });
      const generatedStorageId = await ctx.storage.store(imageBlob);
      const url = await ctx.storage.getUrl(generatedStorageId);
      if (!url) {
        throw new Error("Failed to get storage URL after upload");
      }

      await ctx.runMutation(api.generate.saveGeneratedImage, {
        storageId: generatedStorageId,
        originalImageId,
      });
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "completed",
      });
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      try {
        await ctx.runMutation(api.generate.updateImageStatus, {
          imageId: originalImageId,
          status: "failed",
          error: errorMessage,
        });
      } catch {}
      try {
        const retried = await ctx.runMutation(api.generate.maybeRetryOnce, { imageId: originalImageId });
        if (retried) return null;
      } catch {}
      return null;
    }
  },
});

