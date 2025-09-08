"use client";

import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

// Unified image processing types
export type GenerateUploadUrlFn = () => Promise<string>;
export type ScheduleImageGenerationFn = (args: { storageId: Id<"_storage"> }) => Promise<Id<"images">>;

export interface ProcessImageOptions {
  generateUploadUrl: GenerateUploadUrlFn;
  scheduleImageGeneration: ScheduleImageGenerationFn;
  onSuccess?: (imageId: Id<"images">) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

export interface ProcessImageResult {
  success: boolean;
  imageId?: Id<"images">;
  error?: Error;
}

/**
 * Unified image processing pipeline that handles both camera captures and file uploads
 * Follows DRY principles and uses the same validation and processing logic
 */
export async function processImage(
  file: File,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  const {
    generateUploadUrl,
    scheduleImageGeneration,
    onSuccess,
    onError,
    successMessage = "Image processing started",
    errorMessage = "Failed to process image"
  } = options;

  try {
    // Step 1: Generate upload URL
    const uploadUrl = await generateUploadUrl();

    // Step 2: Upload file to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      keepalive: true, // Helps with page unloads
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }

    const { storageId } = await uploadResponse.json() as { storageId: Id<"_storage"> };

    // Step 3: Schedule image generation
    const imageId = await scheduleImageGeneration({ storageId });

    // Step 4: Show success feedback
    toast.success(successMessage, {
      description: "Your image is being processed in the background. Refresh if needed - generation continues.",
      duration: 4000,
    });

    // Step 5: Call success callback
    onSuccess?.(imageId);

    return { success: true, imageId };

  } catch (error) {
    const processedError = error instanceof Error ? error : new Error(String(error || "Unknown error"));
    
    // Handle specific error types
    let userMessage = errorMessage;
    if (processedError.message.includes("VALIDATION:")) {
      userMessage = processedError.message.replace(/^VALIDATION:\s*/, "");
    } else if (processedError.message.includes("Load failed") || 
               processedError.message.includes("Network") || 
               processedError.message.includes("Failed to fetch")) {
      userMessage = "Network issue during upload. Please check your connection and try again.";
    }

    // Show error feedback
    toast.error("Upload failed", { 
      description: userMessage,
      duration: 5000 
    });

    // Call error callback
    onError?.(processedError);

    return { success: false, error: processedError };
  }
}

/**
 * Process a camera capture (base64 data URL)
 */
export async function processCameraCapture(
  imageDataUrl: string,
  options: ProcessImageOptions
): Promise<ProcessImageResult> {
  try {
    // Convert data URL to File
    const response = await fetch(imageDataUrl);
    const blob = await response.blob();
    const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });

    return await processImage(file, options);
  } catch (error) {
    const processedError = error instanceof Error ? error : new Error("Failed to process camera capture");
    
    toast.error("Camera capture failed", { 
      description: processedError.message,
      duration: 5000 
    });

    options.onError?.(processedError);
    return { success: false, error: processedError };
  }
}

/**
 * Process a file upload with optional preparation (compression/transcoding)
 */
export async function processFileUpload(
  file: File,
  options: ProcessImageOptions & { 
    shouldPrepare?: boolean;
    onPrepareStart?: () => void;
    onPrepareEnd?: () => void;
  }
): Promise<ProcessImageResult> {
  const { shouldPrepare = false, onPrepareStart, onPrepareEnd, ...processOptions } = options;

  try {
    let processedFile = file;

    // Optional preparation step (compression/transcoding)
    if (shouldPrepare) {
      // Client-side validation of type
      const allowed = new Set(["image/jpeg", "image/png", "image/heic", "image/heif"]);
      if (!allowed.has(file.type)) {
        throw new Error("Unsupported file type. Please choose a JPEG, PNG, or HEIC/HEIF image.");
      }

      onPrepareStart?.();

      try {
        const { prepareImageForUpload } = await import("@/lib/imagePrep");
        const { file: prepared } = await prepareImageForUpload(file);
        processedFile = prepared;
      } finally {
        onPrepareEnd?.();
      }
    }

    return await processImage(processedFile, processOptions);
  } catch (error) {
    const processedError = error instanceof Error ? error : new Error("Failed to prepare file");
    
    toast.error("File preparation failed", { 
      description: processedError.message,
      duration: 5000 
    });

    options.onError?.(processedError);
    return { success: false, error: processedError };
  }
}