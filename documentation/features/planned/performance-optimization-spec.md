# Performance Optimization Technical Specification

**Document Name:** Landing Page & App Performance Optimization  
**Date:** December 2024  
**Version:** 1.0  
**Status:** Planning

## Executive Summary

Optimize performance across the Anime Leak application with focus on landing page load times, image delivery, animation smoothness, and Core Web Vitals metrics.

## Current Performance Baseline

**Need to Measure:**

- Lighthouse scores (Performance, Accessibility, Best Practices, SEO)
- Core Web Vitals (LCP, FID, CLS)
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Bundle sizes

**Expected Issues:**

- Hero images not optimized (potentially large files)
- Motion library adds ~40kb
- No image lazy loading strategy
- Potential layout shifts during load
- No caching strategy for featured images

## Target Metrics

### Core Web Vitals

- **LCP (Largest Contentful Paint):** < 2.5s (currently unknown)
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

### Lighthouse Scores

- Performance: 90+ (mobile), 95+ (desktop)
- Accessibility: 100
- Best Practices: 95+
- SEO: 100

### Custom Metrics

- Hero animation starts: < 1.5s after page load
- Image load time: < 500ms per image
- Smooth 60fps animations throughout

## Optimization Phases

### Phase 1: Image Optimization (Priority: CRITICAL)

#### 1.1 Next.js Image Component

**Current:** Mix of `<img>` and `<Image>` usage
**Target:** Use Next.js Image everywhere

**Changes:**

```tsx
// ❌ Before (HeroGalleryDemo.tsx - fallback images)
<img src={imageUrl} alt="..." />

// ✅ After
<Image
  src={imageUrl}
  alt="..."
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
  loading="eager"  // For hero images
  priority         // For above-the-fold
/>
```

#### 1.2 Image Format Optimization

- Serve WebP/AVIF with JPEG fallback
- Use Next.js automatic optimization
- Consider Convex Storage CDN headers

**Convex Storage Headers:**

```typescript
// convex/images.ts - enhance URL generation
export const getOptimizedImageUrl = query({
  args: {
    storageId: v.id("_storage"),
    width: v.optional(v.number()),
    quality: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let url = await ctx.storage.getUrl(args.storageId);

    // Add query params for optimization
    if (args.width) url += `?w=${args.width}`;
    if (args.quality) url += `&q=${args.quality}`;

    return url;
  },
});
```

#### 1.3 Responsive Images

Serve different sizes based on viewport:

```tsx
<Image
  src={imageUrl}
  alt="Transformation"
  fill
  sizes="(max-width: 640px) 100vw,
         (max-width: 1024px) 50vw,
         33vw"
  quality={85} // Slightly reduce quality for better performance
/>
```

#### 1.4 Lazy Loading Strategy

**Hero Section:** Eager load (above fold)
**PublicGallery:** Lazy load (below fold)
**Before/After Showcase:** Lazy load with intersection observer

```tsx
// /components/LazyImage.tsx
"use client";
import { useInView } from "motion/react";
import Image from "next/image";

export function LazyImage({ src, alt, ...props }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "200px" });

  return <div ref={ref}>{isInView && <Image src={src} alt={alt} {...props} />}</div>;
}
```

### Phase 2: Bundle Size Optimization (Priority: HIGH)

#### 2.1 Code Splitting

**Current:** Single bundle includes all components
**Target:** Split by route and lazy load

```tsx
// /app/page.tsx
import dynamic from "next/dynamic";

// Lazy load admin dashboard (not needed for landing page)
const AdminDashboard = dynamic(() => import("@/components/AdminModerationDashboard"), {
  ssr: false,
});

// Lazy load modals
const CreditPurchaseModal = dynamic(() => import("@/components/CreditPurchaseModal"), {
  ssr: false,
});
```

#### 2.2 Motion Library Optimization

**Current:** Import entire motion library
**Target:** Import only used components

```tsx
// ❌ Before
import { motion } from "motion/react";

// ✅ After - tree-shakeable imports
import { m } from "motion/react"; // Smaller import
// Or use motion/mini for basic animations
```

#### 2.3 Bundle Analysis

```bash
# Add to package.json
"analyze": "ANALYZE=true next build"

# Install bundle analyzer
bun add @next/bundle-analyzer
```

**Target Sizes:**

- First Load JS: < 200kb
- Main bundle: < 150kb
- Largest component: < 50kb

### Phase 3: Animation Performance (Priority: HIGH)

#### 3.1 GPU Acceleration

Ensure animations use `transform` and `opacity` only:

```tsx
// ✅ Good - GPU accelerated
<motion.div
  style={{
    transform: "translateY(0)",  // GPU
    scale: 1,                     // GPU
    opacity: 1                    // GPU
  }}
/>

// ❌ Bad - triggers layout recalc
<motion.div
  style={{
    top: 0,        // CPU layout
    width: "100%"  // CPU layout
  }}
/>
```

#### 3.2 Will-Change Hints

Add will-change for animated elements:

```tsx
// /components/ui/hero-gallery-scroll-animation.tsx
<motion.div
  style={{
    willChange: "transform, opacity", // Hint to browser
  }}
/>
```

#### 3.3 Reduce Animation Complexity

- Limit simultaneous animations to 5-7 elements
- Use requestAnimationFrame for scroll listeners
- Debounce/throttle expensive calculations

#### 3.4 Animation Performance Monitoring

```tsx
// Track animation FPS
useEffect(() => {
  let frameId: number;
  let lastTime = performance.now();
  let frames = 0;

  const measureFPS = () => {
    frames++;
    const now = performance.now();

    if (now >= lastTime + 1000) {
      const fps = Math.round((frames * 1000) / (now - lastTime));
      console.log(`Animation FPS: ${fps}`);

      // Track in analytics if low
      if (fps < 50) {
        trackEvent("low_fps", { fps, component: "hero" });
      }

      frames = 0;
      lastTime = now;
    }

    frameId = requestAnimationFrame(measureFPS);
  };

  measureFPS();
  return () => cancelAnimationFrame(frameId);
}, []);
```

### Phase 4: Caching Strategy (Priority: MEDIUM)

#### 4.1 Static Asset Caching

Configure Next.js caching headers:

```typescript
// next.config.ts
export default {
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};
```

#### 4.2 Convex Query Caching

Implement client-side caching for featured images:

```tsx
// /lib/useImageCache.ts
export function useCachedImages() {
  const [cache, setCache] = useState<Map<string, string>>(new Map());

  const featuredResult = useQuery(api.images.getPublicGallery, {
    paginationOpts: { numItems: 5, cursor: null },
  });

  useEffect(() => {
    if (featuredResult?.page) {
      const newCache = new Map(cache);
      featuredResult.page.forEach((img) => {
        newCache.set(img._id, img.url);
      });
      setCache(newCache);

      // Persist to localStorage for instant subsequent loads
      localStorage.setItem("image-cache", JSON.stringify([...newCache]));
    }
  }, [featuredResult]);

  // Hydrate from cache on mount
  useEffect(() => {
    const cached = localStorage.getItem("image-cache");
    if (cached) {
      setCache(new Map(JSON.parse(cached)));
    }
  }, []);

  return cache;
}
```

#### 4.3 Prefetching

Prefetch critical resources:

```tsx
// /app/layout.tsx
<head>
  {/* Prefetch hero images */}
  <link rel="prefetch" as="image" href="/hero-image-1.jpg" />

  {/* Preconnect to Convex */}
  <link rel="preconnect" href="https://your-convex-deployment.convex.cloud" />

  {/* DNS prefetch for external resources */}
  <link rel="dns-prefetch" href="https://images.unsplash.com" />
</head>
```

### Phase 5: Loading States & Skeletons (Priority: MEDIUM)

#### 5.1 Skeleton Screens

Replace spinners with skeleton loaders:

```tsx
// /components/ui/skeleton.tsx (already exists via shadcn)
export function ImageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="bg-muted aspect-square rounded-xl" />
    </div>
  )
}

// /components/HeroGalleryDemo.tsx
{!featuredResult ? (
  <BentoGrid>
    {[...Array(5)].map((_, i) => (
      <BentoCell key={i}>
        <ImageSkeleton />
      </BentoCell>
    ))}
  </BentoGrid>
) : (
  // Actual content
)}
```

#### 5.2 Progressive Image Loading

Show low-quality placeholders first:

```tsx
<Image
  src={highQualityUrl}
  placeholder="blur"
  blurDataURL={lowQualityDataUrl} // Base64 tiny version
  alt="..."
/>
```

#### 5.3 Loading Priority

```tsx
// Hero images (critical)
<Image priority loading="eager" />

// Below-the-fold images
<Image loading="lazy" />
```

### Phase 6: Monitoring & Analytics (Priority: LOW)

#### 6.1 Web Vitals Tracking

```tsx
// /app/layout.tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

#### 6.2 Custom Performance Tracking

```typescript
// /lib/performance.ts
export function trackPerformance(metric: string, value: number) {
  // Send to analytics
  if (typeof window !== "undefined" && "performance" in window) {
    performance.mark(`${metric}-end`);
    performance.measure(metric, `${metric}-start`, `${metric}-end`);
  }
}

// Usage
performance.mark("hero-load-start");
// ... load hero
performance.mark("hero-load-end");
trackPerformance("hero-load", performance.now());
```

## Implementation Checklist

### Quick Wins (< 1 day)

- [ ] Add sizes prop to all Image components
- [ ] Enable next/image for all hero images
- [ ] Add loading="lazy" to below-fold images
- [ ] Add will-change to animated elements

### Medium Effort (1-2 days)

- [ ] Implement skeleton loading states
- [ ] Add image caching strategy
- [ ] Code split large components
- [ ] Optimize bundle with analyzer

### Long-term (3+ days)

- [ ] Set up performance monitoring
- [ ] Create custom image CDN pipeline
- [ ] Implement service worker for offline support
- [ ] Add progressive web app features

## Testing & Verification

### Tools

- **Lighthouse** - Manual audits
- **WebPageTest** - Real-world testing
- **Chrome DevTools** - Performance profiling
- **Vercel Analytics** - Real user monitoring

### Test Scenarios

1. **Cold Load** - First visit, no cache
2. **Warm Load** - Second visit, with cache
3. **Slow 3G** - Mobile network simulation
4. **Low-end Device** - CPU throttling 4x

### Acceptance Criteria

- [ ] LCP < 2.5s on mobile 3G
- [ ] Hero animation smooth 60fps
- [ ] No CLS during page load
- [ ] Bundle size < 200kb first load
- [ ] All images lazy load correctly

## Timeline Estimate

- Phase 1 (Images): 2 days
- Phase 2 (Bundle): 1 day
- Phase 3 (Animations): 1 day
- Phase 4 (Caching): 2 days
- Phase 5 (Loading): 1 day
- Phase 6 (Monitoring): 1 day

**Total: 8 days** (1.5 weeks)

## Success Metrics

- Lighthouse Performance: 90+ → 95+
- LCP: Unknown → <2.5s
- Bundle size: Unknown → <200kb
- User-reported performance issues: Reduced by 80%
