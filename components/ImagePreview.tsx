"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import ImageModal from "./ImageModal";
import { Button } from "./ui/button";

// Infer the type from the actual query return type
type ImageFromQuery = NonNullable<ReturnType<typeof useQuery<typeof api.images.getImages>>>[number];

interface ImagePreviewProps {
  images?: ImageFromQuery[]; // Main image array using inferred type
  uploadedImages?: ImageFromQuery[]; // Alias for backward compatibility
  totalImages?: number; // Total count of all generated images
  currentPage?: number; // Current page number for pagination
  imagesPerPage?: number; // Number of images per page
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

export default function ImagePreview({
  images = [],
  uploadedImages = [],
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: ImagePreviewProps) {
  const [selectedImage, setSelectedImage] = useState<ImageFromQuery | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use images prop if provided, otherwise fallback to uploadedImages for compatibility
  const imagesToDisplay = images.length > 0 ? images : uploadedImages;

  const allImages = imagesToDisplay.map((img, index) => ({
    type: "uploaded" as const,
    data: img,
    index,
  }));

  if (allImages.length === 0 && !isLoading) {
    return null; // Handled by the main page empty state
  }

  return (
    <div className="space-y-6">
      {/* Responsive Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {allImages.map((image) => (
          <div
            key={image.data._id}
            className="group cursor-pointer"
            onClick={() => {
              setSelectedImage(image.data);
              setIsModalOpen(true);
            }}
          >
            <div className="bg-card border border-border/30 hover:border-border transition-all duration-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md">
              <div className="aspect-square relative">
                <Image
                  src={image.data.url}
                  alt="Transformed image"
                  fill
                  className="object-cover transition-all duration-300 group-hover:scale-[1.02]"
                  unoptimized={true}
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex items-center justify-center h-full text-muted-foreground bg-muted/30">
                          <div class="text-center">
                            <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            <div class="text-xs opacity-50">Unable to load</div>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />

                {/* Minimal status indicators */}
                {image.data.generationStatus === "pending" ||
                image.data.generationStatus === "processing" ? (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Minimal Load More */}
      {hasMore && (
        <div className="flex items-center justify-center py-8">
          <Button
            onClick={onLoadMore}
            disabled={isLoading}
            variant="ghost"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                <span>Loading</span>
              </div>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}

      <ImageModal
        image={selectedImage}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedImage(null);
        }}
      />
    </div>
  );
}
