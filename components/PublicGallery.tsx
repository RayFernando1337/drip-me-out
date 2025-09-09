"use client";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useMemo } from "react";
import Image from "next/image";
import { Button } from "./ui/button";

// Same type inference pattern as ImagePreview.tsx
type PublicImageFromQuery = NonNullable<
  ReturnType<typeof useQuery<typeof api.images.getPublicGallery>>
>;

export default function PublicGallery() {
  const [paginationOpts, setPaginationOpts] = useState({
    numItems: 16, // Same page size as existing gallery
    cursor: null,
  });

  const galleryResult = useQuery(api.images.getPublicGallery, { paginationOpts });

  // Same memoization pattern from main page
  const images = useMemo(() => galleryResult?.page || [], [galleryResult?.page]);

  // Same early return pattern
  if (images.length === 0 && galleryResult === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Show empty state if no featured images exist yet
  if (images.length === 0 && galleryResult !== undefined) {
    return (
      <div className="text-center space-y-4 py-12">
        <div className="text-muted-foreground">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
        </div>
        <h3 className="text-lg font-medium">Gallery Coming Soon</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Our community is creating amazing transformations! Featured examples will appear here soon.
        </p>
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

      {/* Exact same grid layout as ImagePreview component */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {images.map((image) => (
          <div key={image._id} className="group">
            {/* Same card styling as ImagePreview */}
            <div className="bg-card border border-border/30 hover:border-border transition-all duration-200 overflow-hidden rounded-xl shadow-sm hover:shadow-md">
              <div className="aspect-square relative">
                <Image
                  src={image.url}
                  alt="Anime transformation example"
                  fill
                  className="object-cover transition-all duration-300 group-hover:scale-[1.02]"
                  unoptimized={true} // Same as existing component
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                  // Same error handling pattern as ImagePreview
                  onError={(e) => {
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

                {/* Featured indicator */}
                <div className="absolute top-2 right-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs px-2 py-1 rounded-full">
                  ✨ Featured
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Same load more pattern as ImagePreview */}
      {galleryResult?.continueCursor && !galleryResult.isDone && (
        <div className="flex items-center justify-center py-8">
          <Button
            onClick={() => setPaginationOpts(prev => ({
              numItems: 16,
              cursor: galleryResult.continueCursor,
            }))}
            variant="ghost"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Show more examples
          </Button>
        </div>
      )}
    </div>
  );
}