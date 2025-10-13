<!-- 008774fe-f8de-4094-8475-4c252ee00750 5d4029c0-c45e-4e32-9551-06a6295b0efa -->
# AnimeLeak Rebrand Implementation Plan

## Overview

Rebrand from "Anime Studio" to "Anime Leak" with updated messaging emphasizing "anime leaking into reality". Remove Studio Ghibli references from customer-facing areas, update social handles, and configure environment variable for site URL.

## 1. Package Configuration

### package.json (line 2)

```json
"name": "animeleak"
```

### convex/payments/createCheckoutSession.ts (line 60)

```typescript
metadata: { userId: session.userId, app: "animeleak" }
```

## 2. Frontend Display Names

### app/page.tsx

- Line 27: `<h1 className="text-2xl font-bold text-white">Anime Leak</h1>`
- Line 407: `<h1 className="text-2xl font-bold text-foreground">Anime Leak</h1>`

## 3. Metadata and SEO

### app/layout.tsx (line 20-21)

```typescript
title: "Anime Leak - Where Anime Leaks Into Reality",
description: "AI-powered anime transformation. Watch everyday objects leak into anime reality with whimsical illustrations and magical effects.",
```

### app/share/[imageId]/page.tsx

- Line 17: `title: "Image Not Found - Anime Leak"`
- Line 23: `title: "Check Out My Anime Transformation!"`
- Line 24: `description: "Watch objects transform as anime leaks into reality. Create yours!"`
- Line 27: `description: "Watch objects transform as anime leaks into reality. Create yours!"`
- Line 34: `description: "Watch objects transform as anime leaks into reality."`

## 4. Taglines and Messaging

### components/HeroGalleryDemo.tsx

- Line 99-100: Replace "Watch everyday items come alive with Studio Ghibli-inspired magic. Our AI transforms ordinary objects into whimsical anime illustrations." with "Where anime leaks into reality. Watch everyday objects transform into whimsical anime illustrations with bold outlines, vibrant colors, and magical effects."
- Line 127: Replace "Studio Ghibli Style" with "Anime Reality"

### app/page.tsx (lines 29, 409)

```typescript
Transform objects into anime illustrations
```

Keep as is - this is clear and direct.

## 5. Social Handles

### components/ImageModal.tsx (line 153)

```typescript
const text = "Check out my anime transformation! Created with @RayFernando1337 🎨✨";
```

## 6. Component Text Updates

### components/PublicImageModal.tsx (line 94-95)

```typescript
Get inspired by real creations from the Anime Leak community. Sign in to transform your own photos into magical anime illustrations where anime leaks into reality.
```

## 7. Environment Variable Setup

Create `.env.local` (or update existing):

```bash
NEXT_PUBLIC_SITE_URL=https://animeleak.com
NEXT_PUBLIC_CONVEX_URL=<existing_value>
```

Update sharing functions to use environment variable:

### components/ImageModal.tsx

- Line 139: `const shareUrl = \`\${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/share/\${currentImage._id}\`;`
- Line 152: `const shareUrl = \`\${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/share/\${currentImage._id}\`;`

## 8. Documentation Updates

### README.md

- Line 1: `# 🎨 Anime Leak`
- Line 3: `An AI-powered image transformation app that transforms everyday objects into magical anime illustrations where anime leaks into reality.`
- Line 17: `- **🤖 AI-Powered Transformation**: Uses Google's Gemini 2.5 Flash model to transform objects with anime leaking into reality`
- Line 90: `cd animeleak`
- Line 139: `animeleak/`

### CLAUDE.md (line 9)

```
Anime Leak is an AI-powered image transformation app where anime leaks into reality, transforming everyday objects into magical anime illustrations using Google's Gemini 2.5 Flash model.
```

### AGENTS.md (line 7)

```
Anime Leak is an AI-powered image transformation app where anime leaks into reality, transforming everyday objects into magical anime illustrations using Google's Gemini 2.5 Flash model.
```

### documentation/features/planned/README.md (line 1)

```markdown
# Planned Features - Anime Leak
```

### documentation/features/active/unauthenticated-gallery-spec.md (line 378)

```typescript
<h1 className="text-2xl font-bold text-foreground">Anime Leak</h1>
```

## 9. Remove Studio Ghibli References (Customer-Facing Only)

Keep the AI prompt in `convex/generate.ts` as-is since it's internal and guides the AI model effectively.

### app/layout.tsx (line 21)

Already updated in step 3.

## 10. Planned Features Documentation

### documentation/features/planned/seo-marketing-spec.md

Update all references:

- Line 10: `Implement comprehensive SEO optimization and marketing infrastructure to improve search engine rankings, social media sharing, and organic user acquisition for Anime Leak.`
- Line 98, 152, 170, 196: `Anime Leak`
- Lines 154, 157, 171, 172, 214, 258: `https://animeleak.com`
- Line 280: `What is Anime Leak?`
- Line 283-284: `Anime Leak is an AI-powered tool that transforms everyday objects into beautiful anime-style illustrations where anime leaks into reality. Simply upload a photo and watch as our AI creates magical artwork.`
- Line 378: Update tweet to use `animeleak.com` and `@RayFernando1337`
- Lines 174, 175, 333, 334: `https://twitter.com/RayFernando1337`

### documentation/features/planned/performance-optimization-spec.md (line 10)

```
Optimize performance across the Anime Leak application with focus on landing page load times...
```

### documentation/features/planned/landing-page-enhancements-spec.md

- Line 10: `Enhance the landing page experience to better showcase the transformation capabilities of Anime Leak.`
- Line 74: `"Original" | "Anime Leak Magic"`
- Line 124: `2. **Anime Reality Style** - Magical anime aesthetic where anime leaks into reality`

## 11. Historical Documentation

Update completed feature docs to reflect the rebrand for consistency:

### documentation/features/completed/ui-redesign-minimalist/ (all files)

- Update references from "Anime Studio" to "Anime Leak"
- Update messaging to reference the leak concept

### documentation/features/completed/image-sharing/ (spec and progress files)

- Line 6: `Project: Anime Leak - AI Anime Transformation`
- Line 7, 12: Update to `Anime Leak application`

## Implementation Order

1. Update environment variable and package.json
2. Update frontend display text (app/page.tsx, HeroGalleryDemo.tsx)
3. Update metadata (app/layout.tsx, app/share/[imageId]/page.tsx)
4. Update sharing components (ImageModal.tsx, PublicImageModal.tsx)
5. Update documentation (README.md, CLAUDE.md, AGENTS.md)
6. Update planned features documentation
7. Update historical documentation for consistency
8. Test sharing URLs with new environment variable
9. Verify all customer-facing text uses new branding

## Notes

- Keep AI prompt in convex/generate.ts unchanged - it's internal and effective
- Ensure NEXT_PUBLIC_SITE_URL is set in deployment environment
- bun.lock will auto-update when package.json changes during next install