"use client";

import { ImageOff } from "lucide-react";
import Image, { type ImageProps } from "next/image";
import { useMemo, useState, type CSSProperties } from "react";

export type ImageWithFallbackProps = ImageProps & {
  fallbackText?: string;
};

export function ImageWithFallback({
  fallbackText = "Unable to load",
  onError,
  className,
  ...props
}: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  // Extract alt to satisfy a11y rule and avoid duplicate props
  const { alt, ...rest } = props;
  // Detect Next.js Image `fill` layout without using `any`
  const isFill = "fill" in rest && (rest as { fill?: boolean }).fill === true;

  const containerStyle: CSSProperties | undefined = useMemo(() => {
    if (isFill) return undefined; // parent should define layout for fill images
    // Try to preserve layout if width/height provided
    const style: CSSProperties = {};
    if (typeof rest.width === "number") style.width = rest.width;
    if (typeof rest.height === "number") style.height = rest.height;
    return style;
  }, [isFill, rest.width, rest.height]);

  if (!failed) {
    return (
      <Image
        alt={alt}
        {...rest}
        className={className}
        onError={(e) => {
          setFailed(true);
          onError?.(e as Parameters<NonNullable<ImageProps["onError"]>>[0]);
        }}
      />
    );
  }

  const Fallback = (
    <div
      className={`flex items-center justify-center bg-muted/30 text-muted-foreground ${isFill ? "absolute inset-0" : ""}`}
      style={containerStyle}
    >
      <div className="flex items-center gap-2">
        <ImageOff className="w-6 h-6 opacity-60" aria-hidden />
        <span className="text-xs opacity-70">{fallbackText}</span>
      </div>
      <span className="sr-only">Image failed to load</span>
    </div>
  );

  return Fallback;
}
