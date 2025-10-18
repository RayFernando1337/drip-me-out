"use node";

import { GoogleGenAI } from "@google/genai";
import { v } from "convex/values";
import imageSize from "image-size";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

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
 * Generate decorated image using Google's Gemini 2.5 Flash model
 * This is now an internal action that can be scheduled
 */
/**
 * Update image generation status
 */
// moved to images.ts

/**
 * Save generated image
 */
// moved to images.ts

// Auto-retry once when generation fails.
// moved to images.ts

// Manual retry from UI
// moved to images.ts

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
      await ctx.runMutation(api.images.updateImageStatus, {
        imageId: originalImageId,
        status: "processing",
      });

      // Get the URL from storage ID
      const baseImageUrl = await ctx.storage.getUrl(storageId);
      if (!baseImageUrl) {
        console.log(
          `[generateImage] Storage missing for originalImageId ${originalImageId}; skipping generation.`
        );
        await ctx.runMutation(api.images.updateImageStatus, {
          imageId: originalImageId,
          status: "failed",
          error: "Original image no longer available",
        });
        return null;
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

      // Convert base64 to Uint8Array and attempt WebP transcoding for storage
      const encoderEndpoint =
        process.env.IMAGE_ENCODER_ENDPOINT ||
        (process.env.NEXT_PUBLIC_SITE_URL
          ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/encode-webp`
          : null);

      if (!encoderEndpoint) {
        throw new Error("Image encoder endpoint not configured");
      }

      const encoderResponse = await fetch(encoderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputBase64: b64Out,
          mimeType,
          quality: 80,
          includePlaceholder: true,
        }),
      });

      if (!encoderResponse.ok) {
        const text = await encoderResponse.text();
        throw new Error(
          `Image encoder failed (${encoderResponse.status}): ${
            text?.slice(0, 200) || encoderResponse.statusText
          }`
        );
      }

      const encoderResult: {
        encodedBase64: string;
        contentType: string;
        width: number | null;
        height: number | null;
        sizeBytes: number;
        placeholderBlurDataUrl?: string;
      } = await encoderResponse.json();

      const encodedBuffer = Buffer.from(encoderResult.encodedBase64, "base64");
      const outputContentType = encoderResult.contentType || mimeType || "image/png";

      const imageBlob = new Blob([encodedBuffer], { type: outputContentType });
      const generatedStorageId = await ctx.storage.store(imageBlob);

      // Verify the generated image was stored properly
      const url = await ctx.storage.getUrl(generatedStorageId);
      if (!url) {
        throw new Error("Failed to get storage URL after upload");
      }

      let fallbackDimensions: ReturnType<typeof imageSize> | null = null;
      const getDimensions = () => {
        if (!fallbackDimensions) {
          fallbackDimensions = imageSize(encodedBuffer);
        }
        return fallbackDimensions;
      };

      const width =
        typeof encoderResult.width === "number"
          ? encoderResult.width
          : (() => {
              const dimensions = getDimensions();
              return typeof dimensions.width === "number" ? dimensions.width : undefined;
            })();
      const height =
        typeof encoderResult.height === "number"
          ? encoderResult.height
          : (() => {
              const dimensions = getDimensions();
              return typeof dimensions.height === "number" ? dimensions.height : undefined;
            })();
      const sizeBytes = encoderResult.sizeBytes ?? encodedBuffer.byteLength;

      // Save the generated image record
      await ctx.runMutation(api.images.saveGeneratedImage, {
        storageId: generatedStorageId,
        originalImageId: originalImageId,
        contentType: outputContentType,
        width,
        height,
        sizeBytes,
        placeholderBlurDataUrl: encoderResult.placeholderBlurDataUrl,
      });

      // Mark the original image as completed
      await ctx.runMutation(api.images.updateImageStatus, {
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
        await ctx.runMutation(api.images.updateImageStatus, {
          imageId: originalImageId,
          status: "failed",
          error: errorMessage,
        });
        console.log(`[generateImage] Marked image ${originalImageId} as failed: ${errorMessage}`);

        // Attempt to refund credits for the failed generation
        try {
          const originalImage: { _id: Id<"images">; userId?: string } | null = await ctx.runQuery(
            internal.images.getImageUserForRefund,
            { imageId: originalImageId }
          );
          if (originalImage?.userId) {
            const refundResult = await ctx.runMutation(api.users.refundCreditsForFailedGeneration, {
              userId: originalImage.userId,
              imageId: originalImageId,
              reason: errorMessage,
            });
            if (refundResult.refunded) {
              console.log(
                `[generateImage] Refunded 1 credit to user ${originalImage.userId}. New balance: ${refundResult.newBalance}`
              );
            }
          }
        } catch (refundError) {
          console.error(`[generateImage] Failed to refund credits:`, refundError);
        }
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
          const retried = await ctx.runMutation(api.images.maybeRetryOnce, {
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

/**
 * Internal query to get image by ID (for refund functionality)
 */
// moved to images.ts
