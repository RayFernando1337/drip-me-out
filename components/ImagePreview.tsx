"use client";

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Image from "next/image";
import { useState } from "react";
import ImageModal from "./ImageModal";

// Infer the type from the actual query return type
type ImageFromQuery = NonNullable<ReturnType<typeof useQuery<typeof api.images.getImages>>>[number];

interface ImagePreviewProps {
  images?: ImageFromQuery[]; // Main image array using inferred type
  totalImages?: number; // Total count of all images
}

export default function ImagePreview({
  images = [],
  totalImages = 0,
}: ImagePreviewProps) {
  const [selectedImage, setSelectedImage] = useState<ImageFromQuery | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use images prop directly
  const imagesToDisplay = images;

  const allImages = imagesToDisplay.map((img, index) => ({
    type: "uploaded" as const,
    data: img,
    index,
  }));

  if (allImages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 border-2 border-dashed border-accent/30 bg-muted/50 rounded-lg">
        <div className="text-center text-muted-foreground">
          <div className="text-6xl mb-4">🎨</div>
          <p className="text-lg font-medium mb-2">No images yet</p>
          <p className="text-sm">Upload or capture an image to see AI-generated versions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalImages} image{totalImages !== 1 ? "s" : ""} ✨
        </p>
      </div>

      {/* 3-Column Grid Layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allImages.map((image) => (
          <div
            key={image.data._id}
            className="group cursor-pointer"
            onClick={() => {
              setSelectedImage(image.data);
              setIsModalOpen(true);
            }}
          >
            <div className="bg-card border-border hover:border-accent transition-colors overflow-hidden rounded-lg">
              <div className="aspect-square relative">
                <Image
                  src={image.data.url}
                  alt={`Image ${new Date(image.data.createdAt).toLocaleDateString()}`}
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                  unoptimized={true}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex items-center justify-center h-full text-muted-foreground">
                          <div class="text-center">
                            <div class="text-2xl mb-1">📷</div>
                            <div class="text-xs">Image</div>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />

                {/* Generation status overlay */}
                {image.data.generationStatus === "failed" ? (
                  <div className="absolute inset-0 bg-red-600/70 flex items-center justify-center">
                    <div className="text-center text-white px-3">
                      <p className="text-sm font-bold">Generation failed</p>
                      {image.data.generationError && (
                        <p className="text-xs opacity-90 mt-1 line-clamp-2">
                          {image.data.generationError}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (image.data.generationStatus === "pending" ||
                  image.data.generationStatus === "processing") ? (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                      <p className="text-sm font-medium">
                        {image.data.generationStatus === "pending" ? "Queued" : "Processing"}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>


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
