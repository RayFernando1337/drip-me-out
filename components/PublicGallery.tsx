"use client";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import PublicImageModal from "./PublicImageModal";
import { ImageWithFallback } from "./ui/ImageWithFallback";

type PublicQueryResult = ReturnType<typeof useQuery<typeof api.images.getPublicGallery>>;
export type PublicGalleryImage = NonNullable<NonNullable<PublicQueryResult>["page"]>[number];

export default function PublicGallery() {
  const [paginationOpts, setPaginationOpts] = useState<{ numItems: number; cursor: string | null }>(
    { numItems: 16, cursor: null }
  );
  const [images, setImages] = useState<PublicGalleryImage[]>([]);
  const [latestPaginationState, setLatestPaginationState] = useState<{
    continueCursor: string | null;
    isDone: boolean;
  }>({ continueCursor: null, isDone: false });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PublicGalleryImage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const galleryResult: PublicQueryResult = useQuery(api.images.getPublicGallery, {
    paginationOpts,
  });
  useEffect(() => {
    if (!galleryResult || !galleryResult.page) {
      return;
    }

    setImages((prev) => {
      const shouldReset = paginationOpts.cursor === null;
      const baseline = shouldReset ? [] : prev;
      const deduped = new Map(baseline.map((image) => [image._id, image]));

      for (const image of galleryResult.page) {
        deduped.set(image._id, image);
      }

      return Array.from(deduped.values());
    });

    setLatestPaginationState({
      continueCursor: galleryResult.continueCursor ?? null,
      isDone: galleryResult.isDone,
    });
    setIsLoadingMore(false);
  }, [galleryResult, paginationOpts.cursor]);

  useEffect(() => {
    if (!selectedImage) return;
    const updated = images.find((img) => img._id === selectedImage._id);
    if (updated && updated !== selectedImage) {
      setSelectedImage(updated);
    }
  }, [images, selectedImage]);

  const hasNoImagesYet = images.length === 0;
  const isInitialLoading = hasNoImagesYet && galleryResult === undefined;
  const showLoadMore =
    Boolean(latestPaginationState.continueCursor) && !latestPaginationState.isDone;

  const openModal = (image: PublicGalleryImage) => {
    setSelectedImage(image);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedImage(null);
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-semibold">See the magic in action</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Real transformations created by our community. Your photos could look this amazing too.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((image, idx) => (
          <button
            key={image._id}
            type="button"
            onClick={() => openModal(image)}
            className="group block text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
            aria-label="View featured transformation"
          >
            <div className="bg-card border border-border/30 hover:border-border transition-all duration-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md">
              <div className="aspect-square relative">
                <ImageWithFallback
                  src={image.url}
                  alt="Anime transformation example"
                  fill
                  priority={idx < 8} // First two rows load with priority
                  loading={idx < 8 ? "eager" : "lazy"}
                  quality={75} // Optimized for gallery thumbnails
                  className="object-cover transition-all duration-300 group-hover:scale-[1.02]"
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33.33vw, 25vw"
                  placeholder={image.placeholderBlurDataUrl ? "blur" : "empty"}
                  blurDataURL={image.placeholderBlurDataUrl}
                />
                <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  ✨ Featured
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {showLoadMore && (
        <div className="flex items-center justify-center py-8">
          <Button
            onClick={() => {
              setIsLoadingMore(true);
              setPaginationOpts({ numItems: 16, cursor: latestPaginationState.continueCursor });
            }}
            variant="ghost"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading more…" : "Show more examples"}
          </Button>
        </div>
      )}

      <PublicImageModal image={selectedImage} isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}
