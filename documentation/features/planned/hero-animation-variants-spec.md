# Hero Animation Variants Technical Specification

**Document Name:** Hero Animation Variants & A/B Testing  
**Date:** December 2024  
**Version:** 1.0  
**Status:** Planning

## Executive Summary

Implement multiple hero animation layouts and A/B testing infrastructure to optimize landing page conversion rates. Current hero uses 5-cell bento grid; add alternative layouts and test which performs best.

## Current State

**Existing Hero:** `/components/HeroGalleryDemo.tsx`
- 5-cell bento grid (default variant)
- Scroll-triggered scale + fade animations
- Fetches 5 featured images from Convex
- Single layout option

## Proposed Variants

### Variant A: Current 5-Cell Bento (Control)
- **Layout:** 8-column grid, asymmetric cells
- **Animation:** Scale from 50% to 100%
- **Best For:** Visual impact, showcasing variety

### Variant B: 4-Cell Balanced Grid
- **Layout:** 3-column grid, 2 rows
- **Animation:** Staggered reveal with rotation
- **Best For:** Cleaner look, faster comprehension

### Variant C: 3-Cell Minimal (Dark Theme)
- **Layout:** 2-column, featured large image + 2 small
- **Animation:** Slide-in from sides
- **Best For:** Premium feel, focus on quality over quantity

### Variant D: Full-Screen Carousel
- **Layout:** Single large image with thumbnails
- **Animation:** Crossfade between images
- **Best For:** Mobile-first experience

### Variant E: Video Background (Future)
- **Layout:** Video of transformation process
- **Animation:** Subtle parallax scroll
- **Best For:** Highest engagement potential

## Architecture Overview

### Component Structure

```
/components/
  /hero-variants/
    HeroVariantA.tsx  // Current 5-cell
    HeroVariantB.tsx  // 4-cell balanced
    HeroVariantC.tsx  // 3-cell minimal
    HeroVariantD.tsx  // Carousel
    HeroController.tsx // A/B testing logic
```

### A/B Testing Implementation

**Option 1: Client-Side (Recommended for MVP)**
```tsx
// /components/HeroController.tsx
"use client"
import { useMemo } from "react"
import HeroVariantA from "./hero-variants/HeroVariantA"
import HeroVariantB from "./hero-variants/HeroVariantB"
import HeroVariantC from "./hero-variants/HeroVariantC"

export default function HeroController() {
  const variant = useMemo(() => {
    // Stable variant selection per user (localStorage)
    const stored = localStorage.getItem("hero-variant")
    if (stored) return stored
    
    // Random assignment on first visit
    const variants = ["A", "B", "C"]
    const selected = variants[Math.floor(Math.random() * variants.length)]
    localStorage.setItem("hero-variant", selected)
    return selected
  }, [])
  
  // Track impression
  useEffect(() => {
    trackEvent("hero_variant_shown", { variant })
  }, [variant])
  
  switch(variant) {
    case "A": return <HeroVariantA />
    case "B": return <HeroVariantB />
    case "C": return <HeroVariantC />
    default: return <HeroVariantA />
  }
}
```

**Option 2: Server-Side (Advanced)**
- Use middleware to assign variant via cookie
- Edge function determines variant before page load
- Better for SEO, no flash of content

## Implementation Phases

### Phase 1: Create Additional Variants (Week 1)
- [x] Variant A already exists (current)
- [ ] Implement Variant B (4-cell balanced)
- [ ] Implement Variant C (3-cell minimal)
- [ ] Update HeroGalleryDemo to be HeroVariantA

### Phase 2: A/B Testing Infrastructure (Week 1)
- [ ] Create HeroController with client-side assignment
- [ ] Add analytics tracking for variant impressions
- [ ] Track conversions (sign-in clicks) per variant
- [ ] Add admin dashboard to view results

### Phase 3: Data Collection (Week 2-3)
- [ ] Run test with 33% traffic split
- [ ] Collect minimum 1000 impressions per variant
- [ ] Monitor bounce rate, scroll depth, conversions

### Phase 4: Analysis & Winner Selection (Week 4)
- [ ] Statistical significance testing
- [ ] Choose winning variant
- [ ] Remove underperforming variants
- [ ] Deploy winner to 100% traffic

## Convex Backend Changes

### New Table: AB Tests

```typescript
// convex/schema.ts
defineTable({
  testName: v.string(),        // "hero-variant-test-2024-12"
  variantShown: v.string(),    // "A", "B", "C"
  userId: v.optional(v.string()), // Clerk user ID if available
  sessionId: v.string(),       // Anonymous session tracking
  timestamp: v.number(),
  
  // Event tracking
  event: v.string(),           // "impression", "scroll", "cta_click", "signup"
  scrollDepth: v.optional(v.number()), // 0-100%
  timeOnPage: v.optional(v.number()),  // seconds
})
.index("by_testName_and_variant", ["testName", "variantShown"])
.index("by_sessionId", ["sessionId"])
```

### Analytics Mutations

```typescript
// convex/analytics.ts

export const trackHeroImpression = mutation({
  args: {
    testName: v.string(),
    variant: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("abTests", {
      testName: args.testName,
      variantShown: args.variant,
      sessionId: args.sessionId,
      event: "impression",
      timestamp: Date.now(),
    })
  }
})

export const trackHeroEvent = mutation({
  args: {
    testName: v.string(),
    sessionId: v.string(),
    event: v.string(),
    scrollDepth: v.optional(v.number()),
    timeOnPage: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Track user interactions with hero
  }
})
```

### Analytics Queries

```typescript
export const getABTestResults = query({
  args: { testName: v.string() },
  handler: async (ctx, args) => {
    // Aggregate results by variant
    // Return: impressions, clicks, conversions, conversion rate
  }
})
```

## Variant Design Specs

### Variant B: 4-Cell Balanced

**Grid Layout:**
```
[  Cell 1  ] [  Cell 2  ]
[  Cell 3  ] [  Cell 4  ]
```

**Animation Timeline:**
- 0-30%: All cells at 50% scale, hidden
- 30-50%: Cell 1 scales + rotates in
- 40-60%: Cell 2 scales + rotates in
- 50-70%: Cell 3 scales + rotates in
- 60-80%: Cell 4 scales + rotates in
- 80-100%: Text fades out

### Variant C: 3-Cell Minimal

**Grid Layout:**
```
[ Cell 1 (Large) ] [ Cell 2 ]
                   [ Cell 3 ]
```

**Animation Timeline:**
- Dark background (slate-900)
- Cells slide in from left/right
- Glass-morphism effect on cells
- Slower, more dramatic animation

## Testing Metrics

### Primary Metric: Conversion Rate
- **Definition:** % of visitors who click "Start Creating"
- **Target:** Variant with >10% improvement over control
- **Sample Size:** 1000 impressions per variant minimum

### Secondary Metrics
- **Scroll Depth:** % reaching CTA section
- **Time on Hero:** Average seconds on hero section
- **Bounce Rate:** % leaving without interaction

### Statistical Significance
- Use Chi-square test for conversion comparison
- Require p-value < 0.05
- Minimum effect size: 10% relative improvement

## Performance Considerations

- Lazy load non-active variants
- Preload variant-specific images after assignment
- Monitor Largest Contentful Paint (LCP) per variant
- Ensure all variants < 2.5s LCP

## Mobile Optimization

- Test variants on mobile separately
- Consider mobile-specific variant (carousel)
- Ensure touch gestures work smoothly
- Test on iOS Safari and Chrome Android

## Timeline Estimate

- Phase 1: 3 days (create variants)
- Phase 2: 2 days (A/B infrastructure)
- Phase 3: 14 days (data collection)
- Phase 4: 1 day (analysis)

**Total: 20 days** (3 weeks)

## Success Criteria

- [ ] All variants render without errors
- [ ] A/B test assigns variants randomly
- [ ] Assignment persists across sessions
- [ ] Analytics track all events correctly
- [ ] Statistically significant winner identified
- [ ] Winner improves conversion by ≥10%
