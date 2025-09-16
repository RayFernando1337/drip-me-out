"use client";
import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import { Button } from "@/components/ui/button";

type PublicQueryResult = ReturnType<typeof useQuery<typeof api.images.getPublicGallery>>;
type PublicGalleryImage = NonNullable<NonNullable<PublicQueryResult>["page"]>[number];

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

  const galleryResult: PublicQueryResult = useQuery(api.images.getPublicGallery, { paginationOpts });
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

  const hasNoImagesYet = images.length === 0;
  const isInitialLoading = hasNoImagesYet && galleryResult === undefined;
  const showLoadMore = Boolean(latestPaginationState.continueCursor) && !latestPaginationState.isDone;

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
        {images.map((image) => (
          <div key={image._id} className="group">
            <div className="bg-card border border-border/30 hover:border-border transition-all duration-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md">
              <div className="aspect-square relative">
                <Image
                  src={image.url}
                  alt="Anime transformation example"
                  fill
                  className="object-cover transition-all duration-300 group-hover:scale-[1.02]"
                  unoptimized={true}
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    // Hide broken image and show fallback message in parent
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div class="flex items-center justify-center h-full text-muted-foreground bg-muted/30">
                          <div class="text-center">
                            <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a 2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a 2 2 0 00-2 2v12a 2 2 0 002 2z"/>
                            </svg>
                            <div class="text-xs opacity-50">Unable to load</div>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />
                <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  ✨ Featured
                </div>
              </div>
            </div>
          </div>
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
    </div>
  );
}
