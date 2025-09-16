"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-3xl w-[min(92vw,768px)] overflow-hidden p-0">
        <div className="flex flex-col md:flex-row">
          <div className="relative md:w-2/3 bg-black/5">
            <div className="relative w-full h-[320px] sm:h-[420px] md:h-[520px] lg:h-[560px] max-h-[70vh]">
              <Image
                src={image.url}
                alt="Featured transformation preview"
                fill
                className="object-contain"
                sizes="(max-width: 768px) 100vw, 66vw"
                unoptimized={true}
                priority={false}
                onError={(event) => {
                  const target = event.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div class=\"flex items-center justify-center h-full text-muted-foreground bg-muted\">
                        <div class=\"text-center space-y-2\">
                          <svg class=\"w-8 h-8 mx-auto opacity-50\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
                            <path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\" d=\"M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a 2 2 0 00-2 2v12a 2 2 0 002 2z\"/>
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

          <div className="flex flex-col md:w-1/3 justify-between gap-6 p-6 bg-background">
            <DialogHeader className="text-left space-y-2">
              <DialogTitle>Featured transformation</DialogTitle>
              <DialogDescription>
                {featuredDateLabel ? `Featured ${featuredDateLabel}` : "Gallery highlight from our community"}
              </DialogDescription>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              Get inspired by real creations from the Drip Me Out community. Sign in to transform your own
              photos with shimmering diamond chains and anime flair.
            </p>

            <SignInButton>
              <Button className="w-full">Sign in to create yours</Button>
            </SignInButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default memo(PublicImageModal);
