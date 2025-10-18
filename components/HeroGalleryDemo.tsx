"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { AuraBackground } from "./ui/AuraBackground";
import { ImageWithFallback } from "./ui/ImageWithFallback";

const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1613376023733-0a73315d9b06?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1633218388467-539651dcf81a?q=80&w=2000&auto=format&fit=crop",
];

export default function HeroGalleryDemo() {
  // Fetch featured images with pagination (12 images)
  const featuredResult = useQuery(api.images.getPublicGallery, {
    paginationOpts: { numItems: 12, cursor: null },
  });

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Convert featured images to normalized format - SHOW ALL
  const allImages = useMemo(() => {
    if (featuredResult?.page && featuredResult.page.length > 0) {
      return featuredResult.page.map((img) => ({
        url: img.url,
        id: img._id,
        isFeatured: true,
      }));
    }
    // Only show fallback images if query has completed and returned empty
    if (featuredResult?.page && featuredResult.page.length === 0) {
      return FALLBACK_IMAGES.map((url, idx) => ({
        url,
        id: `fallback-${idx}`,
        isFeatured: false,
      }));
    }
    // Return empty array while loading (prevents flash of fallback images)
    return [];
  }, [featuredResult]);

  const handleNext = () => {
    setSelectedIndex((prev) => (prev + 1) % allImages.length);
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleSelectImage = (index: number) => {
    setSelectedIndex(index);
  };

  // Reset selectedIndex when allImages changes (reactive updates from Convex)
  useEffect(() => {
    // If selected index is out of bounds, reset to 0
    if (allImages.length > 0 && selectedIndex >= allImages.length) {
      setSelectedIndex(0);
    }
  }, [allImages.length, selectedIndex]);

  // Compute a safe index that's always within bounds (prevents race condition)
  const safeSelectedIndex =
    allImages.length > 0 ? Math.min(selectedIndex, allImages.length - 1) : 0;

  // Show loading state while images are being fetched
  const isLoading = featuredResult === undefined || allImages.length === 0;

  return (
    <div className="relative min-h-screen w-full">
      {/* Fixed Aura Background */}
      <AuraBackground />

      {/* Two-Column Hero Layout */}
      <div className="container mx-auto px-6 py-12 min-h-screen flex items-center">
        {isLoading ? (
          /* Loading State */
          <div className="w-full text-center space-y-6">
            <div className="w-16 h-16 mx-auto border-4 border-white/20 border-t-white rounded-full animate-spin" />
            <p className="text-gray-300 text-lg">Loading gallery...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-center">
            {/* Left Column: Text + CTA */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.3)]">
                  Transform Objects Into Anime Art
                </h1>
                <p className="text-lg md:text-xl text-gray-200 leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  Where anime leaks into reality. Watch everyday objects transform into whimsical
                  anime illustrations with bold outlines, vibrant colors, and magical effects.
                </p>
              </div>

              <div className="flex items-center gap-4">
                <SignInButton>
                  <Button
                    size="lg"
                    className="px-8 py-6 text-base font-medium rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 bg-white text-black hover:bg-gray-100"
                  >
                    Start Creating
                  </Button>
                </SignInButton>
              </div>

              {/* Optional: Feature highlights */}
              <div className="flex items-center gap-6 pt-4 text-sm text-gray-300">
                <div className="flex items-center gap-2">
                  <span>✨</span>
                  <span>AI-Powered</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>⚡</span>
                  <span>Instant Results</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🎨</span>
                  <span>Anime Reality</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Image + Gallery Dock */}
            <div className="space-y-6">
              {/* Large Hero Image */}
              <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl bg-muted/20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={safeSelectedIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="relative w-full h-full"
                  >
                    <ImageWithFallback
                      src={allImages[safeSelectedIndex].url}
                      alt="Featured anime transformation"
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                      priority={true}
                    />
                  </motion.div>
                </AnimatePresence>

                {/* Navigation Arrows */}
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-6 h-6 text-black" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 backdrop-blur-sm hover:bg-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-6 h-6 text-black" />
                </button>
              </div>

              {/* Gallery Dock: Scrollable thumbnails */}
              <div className="relative">
                <div className="flex gap-3 overflow-x-auto pb-2 px-2 scrollbar-hide">
                  {allImages.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => handleSelectImage(index)}
                      className={`
                      relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden 
                      transition-all duration-200 hover:scale-105
                      ${
                        selectedIndex === index
                          ? "ring-4 ring-primary shadow-lg scale-105"
                          : "ring-2 ring-border/30 opacity-70 hover:opacity-100"
                      }
                    `}
                    >
                      <ImageWithFallback
                        src={image.url}
                        alt={`Thumbnail ${index + 1}`}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
