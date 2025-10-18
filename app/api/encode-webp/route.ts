import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";

type EncodeRequest = {
  /**
   * Base64 payload of the source image. May optionally include a `data:*;base64,` prefix.
   */
  inputBase64: string;
  /**
   * Original mime-type, used for fallbacks when WebP encoding fails.
   */
  mimeType?: string;
  /**
   * Desired output quality (0-100). Defaults to 80.
   */
  quality?: number;
  /**
   * When true (default) a small WebP blur placeholder will be generated.
   */
  includePlaceholder?: boolean;
};

type EncodeSuccess = {
  encodedBase64: string;
  contentType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number;
  placeholderBlurDataUrl?: string;
};

function stripDataUrlPrefix(base64: string): string {
  const commaIndex = base64.indexOf(",");
  return base64.startsWith("data:") && commaIndex !== -1 ? base64.slice(commaIndex + 1) : base64;
}

function toDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EncodeRequest;
    const rawBase64 = body.inputBase64?.trim();

    if (!rawBase64) {
      return NextResponse.json({ error: "Missing base64 payload" }, { status: 400 });
    }

    const base64 = stripDataUrlPrefix(rawBase64);
    const sourceBuffer = Buffer.from(base64, "base64");
    const quality = Number.isFinite(body.quality) ? Number(body.quality) : 80;
    const placeholderRequested = body.includePlaceholder !== false;

    const sourceSharp = sharp(sourceBuffer, { failOn: "none" });
    const metadata = await sourceSharp.metadata();

    let encodedBuffer: Buffer | null = null;
    let encodedContentType = "image/webp";

    try {
      encodedBuffer = await sourceSharp.clone().webp({ quality, effort: 4 }).toBuffer();
    } catch (webpError) {
      console.warn("[encode-webp] WebP encoding failed, falling back to original buffer", webpError);
      encodedBuffer = null;
    }

    const outputBuffer = encodedBuffer ?? sourceBuffer;
    if (!encodedBuffer) {
      const inferredFormat =
        metadata.format && metadata.format !== "jpg" ? metadata.format : metadata.format === "jpg" ? "jpeg" : null;
      encodedContentType =
        body.mimeType ??
        (inferredFormat ? `image/${inferredFormat}` : undefined) ??
        "image/png";
    }

    const result: EncodeSuccess = {
      encodedBase64: outputBuffer.toString("base64"),
      contentType: encodedContentType,
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      sizeBytes: outputBuffer.byteLength,
    };

    if (placeholderRequested) {
      try {
        const placeholderBuffer = await sharp(outputBuffer)
          .resize(32, 32, { fit: "inside" })
          .webp({ quality: 60 })
          .toBuffer();
        result.placeholderBlurDataUrl = toDataUrl(placeholderBuffer, "image/webp");
      } catch (placeholderError) {
        console.warn("[encode-webp] Failed to generate blur placeholder", placeholderError);
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[encode-webp] Unexpected error", error);
    return NextResponse.json({ error: "Failed to encode image" }, { status: 500 });
  }
}
