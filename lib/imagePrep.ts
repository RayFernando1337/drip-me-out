"use client";

export type Prepared = { file: File; wasTranscoded: boolean; wasCompressed: boolean };

const ALLOWED_INPUTS = ["image/jpeg", "image/png", "image/heic", "image/heif"] as const;
export type AllowedMime = (typeof ALLOWED_INPUTS)[number];

export function isAllowedType(type: string): type is AllowedMime {
  return (ALLOWED_INPUTS as readonly string[]).includes(type);
}

// Prepare an image for upload: optional HEIC->JPEG transcode and compression to <=5MB, <=2048px
export async function prepareImageForUpload(file: File): Promise<Prepared> {
  if (!isAllowedType(file.type)) {
    throw new Error("Unsupported file type. Allowed: JPEG, PNG, HEIC/HEIF.");
  }

  let working: Blob | File = file;
  let wasTranscoded = false;
  let wasCompressed = false;

  // 1) Transcode HEIC/HEIF -> JPEG when needed
  if (file.type === "image/heic" || file.type === "image/heif") {
    type Heic2Any = (opts: { blob: Blob; toType?: string; quality?: number }) => Promise<Blob>;
    const heic2anyModule = await import("heic2any");
    const heic2any = heic2anyModule.default as unknown as Heic2Any;
    const jpegBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    working = new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
      type: "image/jpeg",
    });
    wasTranscoded = true;
  }

  // 2) Compress/downscale to ≤ 5 MB and max 2048px
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
  const compressed: File = await imageCompression(working as File, {
    maxSizeMB: 5,
    maxWidthOrHeight: 2048,
    fileType: "image/jpeg",
    useWebWorker: true,
    initialQuality: 0.85,
  });

  if (compressed.size < (working as File).size) wasCompressed = true;

  return { file: compressed, wasTranscoded, wasCompressed };
}
