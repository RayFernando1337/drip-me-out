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
import Image from "next/image";
import { memo, useMemo } from "react";
import type { PublicGalleryImage } from "./PublicGallery";

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
              <Image
                src={image.url}
                alt="Featured transformation preview"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 60vw, 640px"
                unoptimized={true}
                priority={false}
                onError={(event) => {
                  const target = event.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class=\"flex h-full items-center justify-center bg-muted text-muted-foreground\">
                        <div class=\"space-y-2 text-center\">
                          <svg class=\"mx-auto h-8 w-8 opacity-50\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                            <path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z\"/>
                          </svg>
                          <div class=\"text-xs opacity-60\">Preview unavailable</div>
                        </div>
                      </div>
                    `;
                  }
                }}
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
