"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignInButton } from "@clerk/nextjs";
import { memo, useMemo } from "react";
import type { PublicGalleryImage } from "./PublicGallery";
import { ImageWithFallback } from "./ui/ImageWithFallback";

interface PublicImageModalProps {
  image: PublicGalleryImage | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(timestamp?: number | null) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function PublicImageModal({ image, isOpen, onClose }: PublicImageModalProps) {
  const featuredDateLabel = useMemo(() => {
    if (!image) return null;
    const featuredTimestamp = image.featuredAt ?? image.createdAt ?? image._creationTime;
    return formatDate(featuredTimestamp);
  }, [image]);

  if (!image) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-4xl w-[min(96vw,960px)] overflow-y-auto p-0 md:overflow-hidden">
        <div className="flex h-full flex-col md:max-h-[90vh] md:flex-row">
          <div className="relative bg-black/5 md:flex-1">
            <div className="relative h-[min(60vh,420px)] w-full md:h-full md:min-h-[520px]">
              <ImageWithFallback
                src={image.url}
                alt="Featured transformation preview"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 640px"
                priority={false}
                placeholder={image.placeholderBlurDataUrl ? "blur" : "empty"}
                blurDataURL={image.placeholderBlurDataUrl}
              />
            </div>
            <div className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1 text-xs font-medium text-white shadow-sm">
              Featured
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-background md:w-[360px] md:border-l md:border-border/50">
            <DialogHeader className="space-y-2 px-6 pt-6 text-left">
              <DialogTitle>Featured transformation</DialogTitle>
              <DialogDescription>
                {featuredDateLabel
                  ? `Featured ${featuredDateLabel}`
                  : "Gallery highlight from our community"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-4 text-sm">
              <p className="text-muted-foreground">
                Get inspired by real creations from the Anime Leak community. Sign in to transform
                your own photos into magical anime illustrations where anime leaks into reality.
              </p>

              <SignInButton>
                <Button className="w-full">Sign in to create yours</Button>
              </SignInButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(PublicImageModal);
