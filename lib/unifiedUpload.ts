"use client";

import type { Id } from "@/convex/_generated/dataModel";

export type GenerateUploadUrl = () => Promise<string>;
export type ScheduleImageGeneration = (args: { storageId: Id<"_storage"> }) => Promise<Id<"images">>;

export interface UploadResult {
  imageId: Id<"images">;
  storageId: Id<"_storage">;
}

/**
 * Unified upload function that handles both file uploads and webcam captures
 * This eliminates duplicate code between the two upload paths
 */
export async function unifiedUpload(
  file: File,
  generateUploadUrl: GenerateUploadUrl,
  scheduleImageGeneration: ScheduleImageGeneration
): Promise<UploadResult> {
  // Attempt upload up to 2 tries if the first fails due to a network-like error
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        keepalive: true,
      } as RequestInit);
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
      }
      
      const { storageId } = (await res.json()) as { storageId: string };
      const imageId = await scheduleImageGeneration({ storageId: storageId as Id<"_storage"> });
      
      return { imageId, storageId: storageId as Id<"_storage"> };
    } catch (err) {
      lastErr = err;
      if (attempt === 1 && isNetworkLikeError(err)) {
        // Retry once with a fresh signed URL
        continue;
      }
      break;
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Upload failed")));
}

function isNetworkLikeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || "");
  return (
    msg.includes("NetworkError") ||
    msg.includes("TypeError: Load failed") ||
    msg.includes("network connection was lost") ||
    msg.includes("Failed to fetch") ||
    msg.includes("Network request failed")
  );
}