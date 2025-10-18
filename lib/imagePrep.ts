"use client";

export type Prepared = {
  file: File;
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
  placeholderBlurDataUrl?: string;
  wasTranscoded: boolean;
  wasCompressed: boolean;
};

const ALLOWED_INPUTS = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
] as const;
export type AllowedMime = (typeof ALLOWED_INPUTS)[number];

export function isAllowedType(type: string): type is AllowedMime {
  return (ALLOWED_INPUTS as readonly string[]).includes(type);
}

type DecodedImage = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  cleanup: () => void;
};

async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, width, height) => ctx.drawImage(bitmap, 0, 0, width, height),
      cleanup: () => {
        if (typeof bitmap.close === "function") {
          bitmap.close();
        }
      },
    };
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (event) => {
      URL.revokeObjectURL(objectUrl);
      reject(event instanceof ErrorEvent ? (event.error ?? event) : event);
    };
    img.src = objectUrl;
  });

  return {
    width: image.naturalWidth,
    height: image.naturalHeight,
    draw: (ctx, width, height) => ctx.drawImage(image, 0, 0, width, height),
    cleanup: () => URL.revokeObjectURL(objectUrl),
  };
}

async function createBlurPlaceholder(decoded: DecodedImage): Promise<string | undefined> {
  try {
    const maxDimension = 32;
    const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    decoded.draw(ctx, width, height);

    return canvas.toDataURL("image/webp", 0.6);
  } catch (error) {
    console.warn("[prepareImageForUpload] Failed to generate blur placeholder", error);
    return undefined;
  }
}

// Prepare an image for upload: transcode to WebP when necessary, compress to <=3MB, <=1600px, capture metadata
export async function prepareImageForUpload(file: File): Promise<Prepared> {
  if (!isAllowedType(file.type)) {
    throw new Error("Unsupported file type. Allowed: JPEG, PNG, HEIC/HEIF, WebP.");
  }

  let working: Blob | File = file;
  let wasTranscoded = false;
  let wasCompressed = false;

  // 1) Transcode HEIC/HEIF -> WebP when needed
  if (file.type === "image/heic" || file.type === "image/heif") {
    type Heic2Any = (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob>;
    const heic2anyModule = await import("heic2any");
    const heic2any = heic2anyModule.default as unknown as Heic2Any;
    const webpBlob = await heic2any({ blob: file, toType: "image/webp", quality: 0.85 });
    working = new File([webpBlob], file.name.replace(/\.(heic|heif)$/i, ".webp"), {
      type: "image/webp",
    });
    wasTranscoded = true;
  }

  // 2) Compress/downscale to ≤ 3 MB and max 1600px (only if needed)
  let compressed: File = working as File;

  // Skip compression if image is already small enough (< 1MB)
  const needsCompression = working.size > 1 * 1024 * 1024;

  if (needsCompression) {
    type ImageCompression = (
      file: File,
      options: {
        maxSizeMB?: number;
        maxWidthOrHeight?: number;
        fileType?: string;
        useWebWorker?: boolean;
        initialQuality?: number;
      }
    ) => Promise<File>;
    const imageCompressionModule = await import("browser-image-compression");
    const imageCompression = imageCompressionModule.default as unknown as ImageCompression;
    compressed = await imageCompression(working as File, {
      maxSizeMB: 3,
      maxWidthOrHeight: 1600,
      fileType: "image/webp",
      useWebWorker: true,
      initialQuality: 0.82,
    });

    if (compressed.size < (working as File).size) wasCompressed = true;
  }

  const normalizedFile =
    compressed.type === "image/webp"
      ? compressed
      : new File([compressed], `${compressed.name.replace(/\.[^.]+$/, "") || "upload"}.webp`, {
          type: "image/webp",
        });

  const decoded = await decodeImage(normalizedFile);
  const width = decoded.width;
  const height = decoded.height;
  let blurDataUrl: string | undefined;
  try {
    blurDataUrl = await createBlurPlaceholder(decoded);
  } finally {
    decoded.cleanup();
  }

  return {
    file: normalizedFile,
    contentType: "image/webp",
    width,
    height,
    sizeBytes: normalizedFile.size,
    placeholderBlurDataUrl: blurDataUrl,
    wasTranscoded,
    wasCompressed,
  };
}
