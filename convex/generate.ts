import { GoogleGenAI } from "@google/genai";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, mutation } from "./_generated/server";

/**
 * Helper function to convert ArrayBuffer to base64 (Convex-compatible)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Helper function to convert base64 to Uint8Array (Convex-compatible)
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binaryString.length));
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate decorated image using Google's Gemini 2.5 Flash model
 * This is now an internal action that can be scheduled
 */
/**
 * Update image generation status
 */
export const updateImageStatus = mutation({
  args: {
    imageId: v.id("images"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { imageId, status, error } = args;

    const existing = await ctx.db.get(imageId);
    if (!existing) {
      return null;
    }

    const updateData: {
      generationStatus: "pending" | "processing" | "completed" | "failed";
      generationError?: string;
    } = { generationStatus: status };
    if (error) {
      updateData.generationError = error;
    }

    await ctx.db.patch(imageId, updateData);
    return null;
  },
});

/**
 * Save generated image
 */
export const saveGeneratedImage = mutation({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
  },
  returns: v.union(v.id("images"), v.null()),
  handler: async (ctx, args) => {
    const { storageId, originalImageId } = args;
    const originalImage = await ctx.db.get(originalImageId);
    if (!originalImage) {
      try {
        await ctx.storage.delete(storageId);
      } catch (error) {
        console.warn("[saveGeneratedImage] Failed to delete orphaned storage", {
          storageId,
          error,
        });
      }
      return null;
    }

    const generatedImageId = await ctx.db.insert("images", {
      body: storageId,
      createdAt: Date.now(),
      isGenerated: true,
      originalImageId: originalImageId,
      userId: originalImage.userId,
      sharingEnabled: originalImage.sharingEnabled,
      shareExpiresAt: originalImage.shareExpiresAt,
    });
    return generatedImageId;
  },
});

// Auto-retry once when generation fails.
export const maybeRetryOnce = mutation({
  args: { imageId: v.id("images") },
  returns: v.boolean(),
  handler: async (ctx, { imageId }) => {
    const img = await ctx.db.get(imageId);
    if (!img || img.isGenerated) return false;
    const attempts = (img.generationAttempts ?? 0) + 1;
    await ctx.db.patch(imageId, { generationAttempts: attempts });
    if (attempts <= 1) {
      // Reset to pending and clear error before retry
      await ctx.db.patch(imageId, { generationStatus: "pending", generationError: undefined });
      const storageId = img.body as unknown as Id<"_storage">;
      const meta = await ctx.db.system.get(storageId);
      const contentType: string | undefined = (meta as { contentType?: string } | null)
        ?.contentType;
      await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
        storageId,
        originalImageId: imageId,
        contentType,
      });
      return true;
    }
    return false;
  },
});

// Manual retry from UI
export const retryOriginal = mutation({
  args: { imageId: v.id("images") },
  returns: v.null(),
  handler: async (ctx, { imageId }) => {
    const img = await ctx.db.get(imageId);
    if (!img || img.isGenerated) return null;
    // Reset status and error; do not modify attempts here (manual retries not limited)
    await ctx.db.patch(imageId, { generationStatus: "pending", generationError: undefined });
    const storageId = img.body as unknown as Id<"_storage">;
    const meta = await ctx.db.system.get(storageId);
    const contentType: string | undefined = (meta as { contentType?: string } | null)?.contentType;
    await ctx.scheduler.runAfter(0, internal.generate.generateImage, {
      storageId,
      originalImageId: imageId,
      contentType,
    });
    return null;
  },
});

export const generateImage = internalAction({
  args: {
    storageId: v.id("_storage"),
    originalImageId: v.id("images"),
    contentType: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { storageId, originalImageId, contentType } = args;

    console.log(
      `[generateImage] Using Gemini 2.5 Flash Image Preview with storageId: ${storageId}, originalImageId: ${originalImageId}`
    );

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API key not configured");
      }

      // Mark the original image as being processed
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "processing",
      });

      // Get the URL from storage ID
      const baseImageUrl = await ctx.storage.getUrl(storageId);
      if (!baseImageUrl) {
        throw new Error("Failed to get image URL from storage");
      }

      // Load the source image and encode as base64 for inlineData
      const response = await fetch(baseImageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch uploaded image from storage: ${response.statusText}`);
      }

      // Prefer validated contentType captured at scheduling time; fall back to response header; default to image/jpeg
      const headerType = response.headers.get("content-type") || undefined;
      const mimeType = contentType || headerType || "image/jpeg";
      const arrayBuffer = await response.arrayBuffer();
      const base64Image = arrayBufferToBase64(arrayBuffer);

      const ai = new GoogleGenAI({ apiKey });

      // Follow the official SDK example: text + inlineData parts
      const contents = [
        {
          text: `Identify 1-3 key objects in the image that would create maximum visual impact when stylized (prioritize: food being eaten, drinks, objects being held, or prominent items in the scene).

Transform these objects into exaggerated 2D whimsical anime illustrations with:

STYLE REQUIREMENTS:
- Bold black outlines with hand-drawn wobbles
- Vibrant, flat anime colors 
- Dramatically exaggerated proportions (make it 2-3x more dramatic than realistic)

ADD DYNAMIC ELEMENTS:
- Create motion lines, swirls, or flowing extensions coming OUT from the object
- For food: add steam swirls, floating ingredients, or exaggerated textures spilling upward
- For drinks: add splash effects, bubbles, or pour animations
- For objects: add sparkles, energy lines, or playful emanations
- Make elements appear to "break free" from the photo into illustrated space

ANIMATION FEEL:
- Should look like a Studio Ghibli food scene inserted into real life
- Emphasize movement even in still objects (swaying, floating, emanating)
- Add small cartoon details like shine marks, emotion symbols, or tiny decorative swirls
- Go BOLD - if it doesn't make someone say "whoa!", make it more exaggerated

Keep humans photorealistic. Other background elements can have subtle stylization if it enhances the overall magical effect, but the main object(s) should be the star.

The goal: create a surreal moment where anime has leaked into reality in the most delightful way possible.`,
        },
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
      ];

      const genResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents,
      });

      const candidates = genResponse.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("Gemini returned no candidates");
      }

      // Find first inlineData part with image data
      let b64Out: string | null = null;
      const parts: Array<{
        text?: string;
        inlineData?: { mimeType?: string; data?: string };
      }> = candidates[0].content?.parts ?? [];

      for (const part of parts) {
        if (part.inlineData?.data) {
          b64Out = part.inlineData.data;
          break;
        }
      }

      if (!b64Out) {
        throw new Error("Gemini response did not include image data");
      }

      // Convert base64 to Uint8Array and store in Convex storage
      const imageBuffer = base64ToUint8Array(b64Out);
      const imageBlob = new Blob([imageBuffer as BlobPart], { type: "image/png" });
      const generatedStorageId = await ctx.storage.store(imageBlob);

      // Verify the generated image was stored properly
      const url = await ctx.storage.getUrl(generatedStorageId);
      if (!url) {
        throw new Error("Failed to get storage URL after upload");
      }

      // Save the generated image record
      await ctx.runMutation(api.generate.saveGeneratedImage, {
        storageId: generatedStorageId,
        originalImageId: originalImageId,
      });

      // Mark the original image as completed
      await ctx.runMutation(api.generate.updateImageStatus, {
        imageId: originalImageId,
        status: "completed",
      });

      console.log(
        `[generateImage] Successfully generated image for originalImageId: ${originalImageId}`
      );
    } catch (error) {
      console.error(`[generateImage] Failed to generate image:`, error);

      // Always ensure we update the status to failed if processing was started
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred during generation";

      try {
        await ctx.runMutation(api.generate.updateImageStatus, {
          imageId: originalImageId,
          status: "failed",
          error: errorMessage,
        });
        console.log(`[generateImage] Marked image ${originalImageId} as failed: ${errorMessage}`);
      } catch (updateError) {
        console.error(
          `[generateImage] CRITICAL: Failed to update image status to failed:`,
          updateError
        );
        console.error(`[generateImage] Original generation error: ${errorMessage}`);
        // This is critical - if we can't update status, the image will be stuck as "processing"
      }

      // Only auto-retry if this wasn't an API key or fundamental configuration error
      const shouldRetry =
        !errorMessage.includes("API key") &&
        !errorMessage.includes("not configured") &&
        !errorMessage.includes("Missing storage metadata");

      if (shouldRetry) {
        try {
          const retried = await ctx.runMutation(api.generate.maybeRetryOnce, {
            imageId: originalImageId,
          });
          if (retried) {
            console.log(`[generateImage] Auto-retry scheduled for ${originalImageId}`);
          }
        } catch (retryError) {
          console.error(`[generateImage] Failed to schedule auto-retry:`, retryError);
        }
      } else {
        console.log(
          `[generateImage] Skipping auto-retry for ${originalImageId} due to configuration error`
        );
      }
    }

    return null;
  },
});
