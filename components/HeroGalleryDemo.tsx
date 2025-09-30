"use client";

import { BentoCell, BentoGrid, ContainerScale, ContainerScroll } from "@/components/ui/hero-gallery-scroll-animation";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { useMemo, useEffect, useState } from "react";
import { ImageWithFallback } from "./ui/ImageWithFallback";

// Curated fallback images for empty state (anime/transformation themed)
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1613376023733-0a73315d9b06?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1633218388467-539651dcf81a?q=80&w=2000&auto=format&fit=crop",
];

// Fisher-Yates shuffle algorithm
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function HeroGalleryDemo() {
  // Fetch MORE featured images from Convex (up to 20 for cycling)
  const featuredResult = useQuery(api.images.getPublicGallery, {
    paginationOpts: { numItems: 20, cursor: null },
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  // Convert featured images to normalized format
  const allFeaturedImages = useMemo(() => {
    if (featuredResult?.page && featuredResult.page.length > 0) {
      return featuredResult.page.map((img) => ({
        url: img.url,
        id: img._id,
        isFeatured: true,
      }));
    }
    return FALLBACK_IMAGES.map((url, idx) => ({
      url,
      id: `fallback-${idx}`,
      isFeatured: false,
    }));
  }, [featuredResult]);

  // Shuffle images once on mount for randomization
  const shuffledImages = useMemo(() => {
    return shuffleArray(allFeaturedImages);
  }, [allFeaturedImages]);

  // Select 5 images to display based on current index
  const images = useMemo(() => {
    if (shuffledImages.length <= 5) {
      return shuffledImages;
    }
    
    // Cycle through images in groups of 5
    const startIdx = currentIndex % shuffledImages.length;
    const selected = [];
    
    for (let i = 0; i < 5; i++) {
      const idx = (startIdx + i) % shuffledImages.length;
      selected.push(shuffledImages[idx]);
    }
    
    return selected;
  }, [shuffledImages, currentIndex]);

  // Auto-rotate through images every 10 seconds
  useEffect(() => {
    if (shuffledImages.length <= 5) return; // Don't rotate if we have 5 or fewer
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 5) % shuffledImages.length);
    }, 10000); // Rotate every 10 seconds
    
    return () => clearInterval(interval);
  }, [shuffledImages.length]);

  return (
    <ContainerScroll className="h-[350vh] bg-gradient-to-b from-background via-background to-muted/20">
      <BentoGrid className="sticky left-0 top-0 z-0 h-screen w-full p-4">
        {images.map((image, index) => (
          <BentoCell
            key={`${image.id}-${currentIndex}-${index}`}
            className="overflow-hidden rounded-xl shadow-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          >
            <ImageWithFallback
              src={image.url}
              alt="Anime transformation example"
              fill
              className="size-full object-cover object-center"
              unoptimized={true}
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </BentoCell>
        ))}
      </BentoGrid>

      <ContainerScale className="relative z-10 text-center px-6">
        <h1 className="max-w-2xl text-4xl md:text-6xl font-bold tracking-tighter text-foreground">
          Transform Objects Into Anime Art
        </h1>
        <p className="my-6 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
          Watch everyday items come alive with Studio Ghibli-inspired magic. 
          Our AI transforms ordinary objects into whimsical anime illustrations.
        </p>
        <div className="flex items-center justify-center gap-4">
          <SignInButton>
            <Button size="lg" className="px-8 py-6 text-base font-medium rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200">
              Start Creating
            </Button>
          </SignInButton>
        </div>
      </ContainerScale>
    </ContainerScroll>
  );
}
