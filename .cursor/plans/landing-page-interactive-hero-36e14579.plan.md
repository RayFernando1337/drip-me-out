<!-- 36e14579-708e-46e0-ac84-6fe8fd191d6c 91e66091-67f0-44cf-b34c-a3824ea93f99 -->
# Landing Page Interactive Hero Redesign

## Overview

Replace the scroll animation hero with an interactive two-column layout: left side with text/CTA, right side with large hero image and clickable gallery dock below. Add AuraBackground component with fixed positioning. Ensure all featured images are displayed (currently only showing 5 of 20).

## Current Issues

### Featured Images Bug

- `HeroGalleryDemo.tsx` fetches 20 featured images but only displays 5 at a time
- Lines 59-75: Slices shuffled images to show groups of 5
- Lines 77-86: Auto-rotates every 10 seconds, cycling through groups
- Solution: Remove slicing/rotation logic, show all featured images in gallery dock

### Scroll Animation Components

- `ContainerScroll`, `BentoGrid`, `BentoCell`, `ContainerScale` from `components/ui/hero-gallery-scroll-animation.tsx`
- Complex scroll-based animations that will be replaced
- Motion library already installed for new animations

## Implementation Steps

### 1. Create AuraBackground Component

**File:** `components/ui/AuraBackground.tsx`

```tsx
"use client";

import { useEffect } from 'react';

// Declare UnicornStudio on window
declare global {
  interface Window {
    UnicornStudio?: {
      isInitialized: boolean;
      init: () => void;
    };
  }
}

export function AuraBackground() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!window.UnicornStudio) {
      window.UnicornStudio = { isInitialized: false, init: () => {} };
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v1.4.29/dist/unicornStudio.umd.js";
      script.onload = function() {
        if (window.UnicornStudio && !window.UnicornStudio.isInitialized) {
          window.UnicornStudio.init();
          window.UnicornStudio.isInitialized = true;
        }
      };
      (document.head || document.body).appendChild(script);
    }
  }, []);

  return (
    <div className="fixed inset-0 -z-10 w-full h-full pointer-events-none">
      <div 
        data-us-project="inzENTvhzS9plyop7Z6g" 
        className="absolute w-full h-full left-0 top-0"
      />
    </div>
  );
}
```

**Key decisions:**

- `fixed inset-0 -z-10`: Fixed to viewport, behind all content
- `pointer-events-none`: Allows clicks to pass through to content
- `useEffect`: Loads script once on mount
- TypeScript: Declares global `UnicornStudio` interface

### 2. Redesign HeroGalleryDemo Component

**File:** `components/HeroGalleryDemo.tsx`

Replace entire component with new two-column layout:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { SignInButton } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { ImageWithFallback } from "./ui/ImageWithFallback";
import { AuraBackground } from "./ui/AuraBackground";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
    return FALLBACK_IMAGES.map((url, idx) => ({
      url,
      id: `fallback-${idx}`,
      isFeatured: false,
    }));
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

  return (
    <div className="relative min-h-screen w-full">
      {/* Fixed Aura Background */}
      <AuraBackground />

      {/* Two-Column Hero Layout */}
      <div className="container mx-auto px-6 py-12 min-h-screen flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 w-full items-center">
          
          {/* Left Column: Text + CTA */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                Transform Objects Into Anime Art
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Watch everyday items come alive with Studio Ghibli-inspired magic. 
                Our AI transforms ordinary objects into whimsical anime illustrations.
              </p>
            </div>

            <div className="flex items-center gap-4">
              <SignInButton>
                <Button size="lg" className="px-8 py-6 text-base font-medium rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200">
                  Start Creating
                </Button>
              </SignInButton>
            </div>

            {/* Optional: Feature highlights */}
            <div className="flex items-center gap-6 pt-4 text-sm text-muted-foreground">
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
                <span>Studio Ghibli Style</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Image + Gallery Dock */}
          <div className="space-y-6">
            {/* Large Hero Image */}
            <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl bg-muted/20">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.05 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="relative w-full h-full"
                >
                  <ImageWithFallback
                    src={allImages[selectedIndex].url}
                    alt="Featured anime transformation"
                    fill
                    className="object-cover"
                    unoptimized={true}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority={true}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Navigation Arrows */}
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/95 rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background/95 rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-110"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
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
                      ${selectedIndex === index 
                        ? 'ring-4 ring-primary shadow-lg scale-105' 
                        : 'ring-2 ring-border/30 opacity-70 hover:opacity-100'}
                    `}
                  >
                    <ImageWithFallback
                      src={image.url}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized={true}
                      sizes="80px"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Key changes:**

- Removed: `ContainerScroll`, `BentoGrid`, `BentoCell`, `ContainerScale`, `shuffleArray`, auto-rotation
- Added: Two-column grid layout with `lg:grid-cols-2`
- Added: `AuraBackground` component
- Fixed: Shows ALL fetched images (12) in gallery dock, not just 5
- Added: Click handlers for image selection
- Added: Arrow navigation buttons
- Added: `AnimatePresence` from motion for smooth transitions
- Responsive: Single column on mobile, two columns on desktop

### 3. Update Styles (if needed)

**File:** `app/globals.css`

Add scrollbar-hide utility if not present:

```css
@layer utilities {
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

### 4. Clean Up Unused Components (Optional)

**Consider removing (or leaving for future use):**

- `components/ui/hero-gallery-scroll-animation.tsx` - no longer used

## Responsive Design

### Mobile (< 768px)

- Single column layout
- Hero image at top, text/CTA below
- Gallery dock scrolls horizontally
- Full-width layout

### Tablet (768px - 1024px)

- Single column with larger spacing
- Hero image maintains aspect ratio
- Gallery dock shows 4-6 thumbnails visible

### Desktop (> 1024px)

- Two-column grid
- Left: Text/CTA takes ~40% width
- Right: Hero image + gallery takes ~60% width
- Gallery dock shows all thumbnails or scrolls if many

## Performance Considerations

1. **Image Loading:**

   - Hero image uses `priority={true}` for faster LCP
   - Thumbnails use `unoptimized={true}` (Convex URLs)
   - Proper `sizes` attribute for responsive images

2. **Animation Performance:**

   - Motion library animations use GPU acceleration
   - `AnimatePresence` with `mode="wait"` prevents overlapping animations
   - Thumbnail transitions use CSS `transform` (performant)

3. **Data Fetching:**

   - Fetch 12 images (reduced from 20 to match pagination spec)
   - Use existing `getPublicGallery` query
   - Real-time updates via Convex reactivity

## Z-Index Layering

- `-z-10`: AuraBackground (behind everything)
- `z-0`: Default content layer
- `z-10`: Navigation arrows (above hero image)
- `z-50`: Header (existing, from `app/page.tsx`)

## Testing Checklist

- [ ] AuraBackground loads and displays correctly
- [ ] Hero image displays featured transformation
- [ ] Gallery dock shows all 12 featured images
- [ ] Clicking thumbnail updates hero image
- [ ] Arrow buttons navigate through gallery
- [ ] Smooth transitions between images
- [ ] Responsive on mobile, tablet, desktop
- [ ] "Start Creating" button opens sign-in
- [ ] No console errors from UnicornStudio script
- [ ] Performance: No layout shift, smooth 60fps animations

## Files to Modify

1. **Create:** `components/ui/AuraBackground.tsx`
2. **Replace:** `components/HeroGalleryDemo.tsx` (entire file)
3. **Update:** `app/globals.css` (add scrollbar-hide utility)

## Dependencies

- motion (already installed) ✅
- lucide-react (already installed) ✅
- No new dependencies required

## Rollback Plan

If issues arise:

1. Git revert changes to `HeroGalleryDemo.tsx`
2. Remove `AuraBackground.tsx`
3. Original scroll animation will restore

## Future Enhancements

- Add keyboard navigation (arrow keys)
- Auto-play mode toggle
- Lazy load thumbnails
- Share button on hero image
- View count/likes display

### To-dos

- [ ] Create AuraBackground component with fixed positioning and UnicornStudio script loading
- [ ] Redesign HeroGalleryDemo with two-column layout, hero image, and gallery dock showing all featured images
- [ ] Add scrollbar-hide utility to globals.css for gallery dock
- [ ] Test responsive behavior on mobile, tablet, and desktop
- [ ] Test thumbnail clicks, arrow navigation, and smooth transitions
- [ ] Verify AuraBackground loads correctly and stays fixed behind content