"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import ImageModal from "./ImageModal";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./ui/ImageWithFallback";

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
  onDeleted?: (imageId: Id<"images">) => void;
}

export default function ImagePreview({
  images = [],
  uploadedImages = [],
  onLoadMore,
  hasMore = false,
  isLoading = false,
  onDeleted,
}: ImagePreviewProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalImageId, setModalImageId] = useState<string | null>(null);

  // Use images prop if provided, otherwise fallback to uploadedImages for compatibility
  const imagesToDisplay = images.length > 0 ? images : uploadedImages;

  useEffect(() => {
    if (!isModalOpen || modalImageId === null) return;

    const stillExists = imagesToDisplay.some((img) => img._id === modalImageId);
    if (!stillExists) {
      setIsModalOpen(false);
      setSelectedImageIndex(null);
      setModalImageId(null);
    } else if (
      selectedImageIndex !== null &&
      imagesToDisplay[selectedImageIndex]?._id !== modalImageId
    ) {
      const newIndex = imagesToDisplay.findIndex((img) => img._id === modalImageId);
      if (newIndex >= 0) {
        setSelectedImageIndex(newIndex);
      }
    }
  }, [imagesToDisplay, isModalOpen, modalImageId, selectedImageIndex]);

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
        {allImages.map((image) => {
          const width = image.data.originalWidth ?? 1024;
          const height = image.data.originalHeight ?? 1024;
          return (
            <div
              key={image.data._id}
              className="group cursor-pointer"
              onClick={() => {
                setSelectedImageIndex(image.index);
                setIsModalOpen(true);
                setModalImageId(image.data._id);
              }}
            >
              <div className="bg-card border border-border/30 hover:border-border transition-all duration-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md">
                <div className="relative w-full" style={{ aspectRatio: `${width} / ${height}` }}>
                  <ImageWithFallback
                    src={image.data.url}
                    alt="Transformed image"
                    width={width}
                    height={height}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
                    sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                    placeholder={image.data.placeholderBlurDataUrl ? "blur" : "empty"}
                    blurDataURL={image.data.placeholderBlurDataUrl}
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
          );
        })}
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
        images={imagesToDisplay}
        selectedImageIndex={selectedImageIndex}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedImageIndex(null);
          setModalImageId(null);
        }}
        onImageIndexChange={(index) => setSelectedImageIndex(index)}
        onDeleted={onDeleted}
      />
    </div>
  );
}
