"use client";

import { BentoCell, BentoGrid, ContainerScale, ContainerScroll } from "@/components/ui/hero-gallery-scroll-animation";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { useMemo } from "react";
import { ImageWithFallback } from "./ui/ImageWithFallback";

// Curated fallback images for empty state (anime/transformation themed)
const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1613376023733-0a73315d9b06?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1635322966219-b75ed372eb01?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=2000&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1633218388467-539651dcf81a?q=80&w=2000&auto=format&fit=crop",
];

export default function HeroGalleryDemo() {
  // Fetch actual featured images from Convex (first 5 only)
  const featuredResult = useQuery(api.images.getPublicGallery, {
    paginationOpts: { numItems: 5, cursor: null },
  });

  // Use featured images or fallback to curated stock images
  const images = useMemo(() => {
    if (featuredResult?.page && featuredResult.page.length > 0) {
      return featuredResult.page.slice(0, 5).map((img) => ({
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

  return (
    <ContainerScroll className="h-[350vh] bg-gradient-to-b from-background via-background to-muted/20">
      <BentoGrid className="sticky left-0 top-0 z-0 h-screen w-full p-4">
        {images.map((image) => (
          <BentoCell
            key={image.id}
            className="overflow-hidden rounded-xl shadow-xl"
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
