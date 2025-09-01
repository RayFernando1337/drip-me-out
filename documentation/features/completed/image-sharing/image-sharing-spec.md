# Image Sharing Feature Technical Specification

**Document Name:** Image Sharing Feature Implementation Plan  
**Date:** August 31st, 2025  
**Version:** 1.0  
**Project:** Drip Me Out - AI Diamond Chain Generator

---

## Executive Summary

This technical specification outlines the implementation of a comprehensive image sharing feature for the Drip Me Out application. The feature will enable users to click on generated images in the gallery, view them in detail, and share them via unique URLs with configurable privacy settings.

## Architecture Overview

### Current State Analysis

The application currently consists of:
- **Frontend:** Next.js 15 App Router (`/app` directory) with React 19
- **Component Library:** shadcn/ui components in `/components/ui`
- **Backend:** Convex real-time platform handling storage and database
- **Image Pipeline:** Gemini 2.5 Flash API for AI generation

### Key Files and Their Roles

#### Frontend Components
- `/app/page.tsx` (lines 1-367): Main page with image gallery display
- `/components/ImagePreview.tsx` (lines 1-133): Gallery grid component  
- `/components/Webcam.tsx` (lines 1-298): Camera capture interface

#### Backend Functions
- `/convex/images.ts` (lines 1-40): Image CRUD operations
- `/convex/generate.ts` (lines 1-234): AI generation logic
- `/convex/schema.ts` (lines 1-17): Database schema definitions

#### Configuration Files
- `/CLAUDE.md`: Main project guidelines
- `/app/CLAUDE.md`: App Router conventions
- `/components/CLAUDE.md`: Component patterns
- `/convex/CLAUDE.md`: Convex backend rules

---

## Phase 1: Image Modal Foundation

### Objective
Create a modal interface for viewing individual images with full-size display and metadata.

### Component Dependencies
This phase requires the following shadcn/ui components:
- **Dialog** - Already installed (used in existing codebase)
- **Button** - Already installed (used throughout app)

If any components are missing, install with:
```bash
bunx shadcn@latest add [component-name]
```

### Implementation Details

#### 1.1 Create ImageModal Component
**File:** `/components/ImageModal.tsx` (new file)

**Prerequisites - Ensure Dialog component is installed:**
```bash
# Dialog component should already be installed (imported in page.tsx)
# If not present, install with:
bunx shadcn@latest add dialog
```

```typescript
"use client";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ImageModalProps {
  image: {
    _id: string;
    url: string;
    createdAt: number;
    generationStatus?: string;
  } | null;
  isOpen: boolean;
  onClose: () => void;
}
```

**Key Requirements:**
- Use existing Dialog component from `/components/ui/dialog.tsx`
- Implement keyboard navigation (ESC key handler - Dialog component handles this automatically)
- Display image at full resolution with proper aspect ratio
- Show creation timestamp formatted with `toLocaleDateString()`

#### 1.2 Update ImagePreview Component
**File:** `/components/ImagePreview.tsx`
**Modification Location:** Lines 66-108 (image grid mapping)

**Changes Required:**
```typescript
// Add to imports (line 1)
import { useState } from "react";
import ImageModal from "./ImageModal";

// Add state before return (line 32)
const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);

// Modify image div to be clickable (line 67)
<div 
  key={`${image.type}-${image.index}`} 
  className="group cursor-pointer"
  onClick={() => setSelectedImage(image.data)}
>
```

#### 1.3 Add Modal State Management
**File:** `/app/page.tsx`
**Modification Location:** Lines 36-39 (state declarations)

**Verification Steps:**
1. Run `bun run dev` and navigate to http://localhost:3000
2. Click any image in the gallery
3. Modal should appear with full-size image
4. Press ESC or click outside to close
5. Verify all images are clickable

---

## Phase 2: Core Sharing Implementation

### Objective
Implement URL generation, copy-to-clipboard, and public share routes.

### Implementation Details

#### 2.1 Add Share Query to Convex
**File:** `/convex/images.ts`
**Add After:** Line 40

```typescript
export const getImageById = query({
  args: { imageId: v.id("images") },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.imageId);
    if (!image) return null;
    
    // Check if sharing is enabled (will be added in Phase 4)
    const sharingEnabled = image.sharingEnabled !== false;
    if (!sharingEnabled) return null;
    
    // Check expiration (will be added in Phase 4)
    if (image.shareExpiresAt && image.shareExpiresAt < Date.now()) {
      return null;
    }
    
    return {
      ...image,
      url: await ctx.storage.getUrl(image.body),
    };
  },
});
```

**Important:** Follow Convex patterns from `/convex/CLAUDE.md`:
- Use validators with `v.id("images")`
- Return null for not found/unauthorized
- Use `ctx.storage.getUrl()` for signed URLs

#### 2.2 Create Share Route
**File:** `/app/share/[imageId]/page.tsx` (new file)

```typescript
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { preloadQuery } from "convex/nextjs";
import SharePageClient from "./client";

export async function generateMetadata({ params }: { params: { imageId: string } }) {
  const preloaded = await preloadQuery(
    api.images.getImageById,
    { imageId: params.imageId as Id<"images"> }
  );
  
  const image = preloaded.result;
  
  return {
    title: image ? "Dripped Out Image" : "Image Not Found",
    description: "Check out my AI-generated diamond chain photo!",
    openGraph: {
      images: image?.url ? [image.url] : [],
    },
  };
}

export default async function SharePage({ params }: { params: { imageId: string } }) {
  const preloaded = await preloadQuery(
    api.images.getImageById,
    { imageId: params.imageId as Id<"images"> }
  );
  
  return <SharePageClient preloaded={preloaded} />;
}
```

#### 2.3 Create Share Page Client Component
**File:** `/app/share/[imageId]/client.tsx` (new file)

```typescript
"use client";
import { usePreloadedQuery } from "convex/react";
import { Preloaded } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SharePageClient({
  preloaded,
}: {
  preloaded: Preloaded<typeof api.images.getImageById>;
}) {
  const image = usePreloadedQuery(preloaded);
  
  if (!image) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Image Not Found</h1>
          <p className="text-muted-foreground mb-6">
            This image may have expired or sharing may be disabled.
          </p>
          <Link href="/">
            <Button>Go to App</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <img
          src={image.url}
          alt="Shared dripped out image"
          className="w-full rounded-lg shadow-2xl"
        />
        <div className="mt-6 text-center">
          <Link href="/">
            <Button>Create Your Own</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

#### 2.4 Add Share Button to Modal
**File:** `/components/ImageModal.tsx`
**Add to component body:**

```typescript
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Inside component
const [copied, setCopied] = useState(false);

const handleShare = async () => {
  const shareUrl = `${window.location.origin}/share/${image._id}`;
  
  try {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  } catch (err) {
    toast.error("Failed to copy link");
  }
};

// In JSX
<Button onClick={handleShare} className="flex items-center gap-2">
  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
  {copied ? "Copied!" : "Copy Share Link"}
</Button>
```

**Verification Steps:**
1. Click an image to open modal
2. Click "Copy Share Link" button
3. Paste link in new browser tab
4. Verify image loads with metadata
5. Check Open Graph preview using https://www.opengraph.xyz/

---

## Phase 3: Quick Win Enhancements

### Objective
Add optional Twitter sharing and native mobile share capabilities.

### Implementation Details

#### 3.1 Twitter Share Button
**File:** `/components/ImageModal.tsx`
**Add after Copy button:**

```typescript
import { Twitter } from "lucide-react";

const handleTwitterShare = () => {
  const shareUrl = `${window.location.origin}/share/${image._id}`;
  const text = "Check out my AI-generated diamond chain photo! 💎⛓️";
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
  window.open(twitterUrl, "_blank");
};

// Add button (only 5 lines of JSX)
<Button 
  onClick={handleTwitterShare} 
  variant="outline"
  className="flex items-center gap-2"
>
  <Twitter className="w-4 h-4" />
  Share on X
</Button>
```

#### 3.2 Native Mobile Share
**File:** `/components/ImageModal.tsx`
**Add Web Share API check:**

```typescript
import { Share2 } from "lucide-react";

const handleNativeShare = async () => {
  const shareUrl = `${window.location.origin}/share/${image._id}`;
  
  if (navigator.share) {
    try {
      await navigator.share({
        title: "My Dripped Out Photo",
        text: "Check out my AI-generated diamond chain!",
        url: shareUrl,
      });
    } catch (err) {
      // User cancelled or error
      console.log("Share cancelled");
    }
  }
};

// Show button only if supported
{navigator.share && (
  <Button onClick={handleNativeShare} variant="outline">
    <Share2 className="w-4 h-4" />
    Share
  </Button>
)}
```

**Verification Steps:**
1. Test on mobile device (iOS Safari or Android Chrome)
2. Click native share button
3. Verify system share sheet appears
4. Test sharing to different apps

---

## Phase 4: Privacy & Expiration Settings

### Objective
Implement per-image sharing controls with expiration options.

### Component Dependencies
This phase requires additional shadcn/ui components:
- **Switch** - For toggle controls (needs installation)
- **Select** - Already installed (used in Webcam.tsx)

Install missing components:
```bash
bunx shadcn@latest add switch
```

### Implementation Details

#### 4.1 Update Database Schema
**File:** `/convex/schema.ts`
**Modification Location:** Lines 5-12 (images table definition)

```typescript
images: defineTable({
  body: v.string(),
  createdAt: v.number(),
  isGenerated: v.optional(v.boolean()),
  originalImageId: v.optional(v.string()),
  generationStatus: v.optional(v.string()),
  generationError: v.optional(v.string()),
  // New fields for sharing
  sharingEnabled: v.optional(v.boolean()),
  shareExpiresAt: v.optional(v.number()),
})
.index("by_created_at", ["createdAt"])
.index("by_is_generated", ["isGenerated"])
.index("by_generation_status", ["generationStatus"])
.index("by_sharing_enabled", ["sharingEnabled"]) // New index
```

**Important:** After schema change, run `bunx convex dev` to sync.

#### 4.2 Add Share Settings Mutation
**File:** `/convex/images.ts`
**Add after getImageById query:**

```typescript
export const updateShareSettings = mutation({
  args: {
    imageId: v.id("images"),
    sharingEnabled: v.boolean(),
    expirationHours: v.optional(v.number()), // 24, 168 (7d), 720 (30d), null (never)
  },
  handler: async (ctx, args) => {
    const { imageId, sharingEnabled, expirationHours } = args;
    
    const updateData: any = { sharingEnabled };
    
    if (expirationHours) {
      updateData.shareExpiresAt = Date.now() + (expirationHours * 60 * 60 * 1000);
    } else {
      updateData.shareExpiresAt = null;
    }
    
    await ctx.db.patch(imageId, updateData);
  },
});
```

#### 4.3 Add Settings UI to Modal
**File:** `/components/ImageModal.tsx`
**Add settings controls:**

**Prerequisites - Install required shadcn/ui components:**
```bash
# Install Switch component if not already present
bunx shadcn@latest add switch

# Select component should already be installed (used in Webcam.tsx)
# If not, install with:
bunx shadcn@latest add select
```

```typescript
import { Settings, Lock, Unlock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const updateShareSettings = useMutation(api.images.updateShareSettings);

// Add state
const [sharingEnabled, setSharingEnabled] = useState(image?.sharingEnabled !== false);
const [showSettings, setShowSettings] = useState(false);

const handleSharingToggle = async (enabled: boolean) => {
  setSharingEnabled(enabled);
  await updateShareSettings({
    imageId: image._id,
    sharingEnabled: enabled,
    expirationHours: undefined,
  });
  toast.success(enabled ? "Sharing enabled" : "Sharing disabled");
};

const handleExpirationChange = async (value: string) => {
  const hours = value === "never" ? undefined : parseInt(value);
  await updateShareSettings({
    imageId: image._id,
    sharingEnabled: true,
    expirationHours: hours,
  });
  toast.success("Expiration updated");
};

// Settings UI
<div className="border-t pt-4 mt-4">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => setShowSettings(!showSettings)}
    className="w-full justify-between"
  >
    <span className="flex items-center gap-2">
      <Settings className="w-4 h-4" />
      Share Settings
    </span>
  </Button>
  
  {showSettings && (
    <div className="mt-4 space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Enable Sharing</label>
        <Switch
          checked={sharingEnabled}
          onCheckedChange={handleSharingToggle}
        />
      </div>
      
      {sharingEnabled && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Link Expiration</label>
          <Select onValueChange={handleExpirationChange} defaultValue="never">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24">24 hours</SelectItem>
              <SelectItem value="168">7 days</SelectItem>
              <SelectItem value="720">30 days</SelectItem>
              <SelectItem value="never">Never expire</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )}
</div>
```

**Verification Steps:**
1. Open image modal
2. Toggle sharing on/off
3. Verify link returns 404 when disabled
4. Set expiration to 24 hours
5. Verify link works immediately
6. Test expiration logic (adjust system time if needed)

---

## Testing & Verification Checklist

### Phase 1 Verification
- [ ] Images in gallery are clickable
- [ ] Modal opens with full-size image
- [ ] ESC key closes modal
- [ ] Click outside closes modal
- [ ] Image metadata displays correctly

### Phase 2 Verification
- [ ] Share button generates correct URL
- [ ] Copy to clipboard shows success toast
- [ ] Shared URL loads image correctly
- [ ] Open Graph metadata appears in previews
- [ ] 404 page shows for invalid IDs

### Phase 3 Verification
- [ ] Twitter button opens pre-filled tweet
- [ ] Native share appears on mobile only
- [ ] Share sheet includes correct data

### Phase 4 Verification
- [ ] Sharing toggle enables/disables access
- [ ] Expiration times are calculated correctly
- [ ] Expired links show appropriate message
- [ ] Settings persist across sessions

---

## Performance Considerations

1. **Image Loading**: Use Next.js Image component for optimization
2. **Modal Rendering**: Lazy load modal component
3. **URL Generation**: Cache share URLs in component state
4. **Database Queries**: Use Convex indexes for efficient lookups

---

## Security Considerations

1. **Access Control**: Validate sharing status in Convex query
2. **URL Structure**: Use non-sequential IDs (Convex provides this)
3. **Expiration**: Check timestamps server-side
4. **Rate Limiting**: Consider adding share generation limits

---

## Migration & Rollback Plan

### Migration Steps
1. Deploy schema changes first (backwards compatible)
2. Deploy backend queries and mutations
3. Deploy frontend components
4. Test in staging environment
5. Gradual rollout to production

### Rollback Strategy
- Each phase is independently deployable
- No destructive schema changes
- Feature flags can disable UI elements
- Convex versioning allows query rollback

---

## Future Enhancements (Out of Scope)

- Analytics tracking for share metrics
- Custom watermarks on shared images
- Bulk sharing of multiple images
- Integration with Instagram API
- Share templates with custom text

---

## Appendix: File Structure After Implementation

```
/app
  /share
    /[imageId]
      page.tsx       (new - server component)
      client.tsx     (new - client component)
  page.tsx          (modified - lines 36-39)
  
/components
  ImageModal.tsx    (new - full component)
  ImagePreview.tsx  (modified - lines 1, 32, 67)
  
/convex
  images.ts         (modified - add 2 new functions)
  schema.ts         (modified - lines 5-12)
```

---

## Development Commands Reference

```bash
# Start development with Convex watching
bunx convex dev

# In another terminal, start Next.js
bun run dev

# Check TypeScript
bun run build

# Monitor Convex logs
bunx convex logs

# Open Convex dashboard
bunx convex dashboard

# Install shadcn/ui components as needed
bunx shadcn@latest add dialog    # For modal
bunx shadcn@latest add switch    # For toggle controls
bunx shadcn@latest add select    # For dropdown menus
```

---

## Author Notes

This specification is designed for sequential implementation where each phase builds upon the previous one. Each phase is independently verifiable and provides immediate value to users. The implementation follows all established patterns from the CLAUDE.md documentation files and maintains consistency with the existing codebase architecture.

Key architectural decisions:
- Leveraging Convex's real-time capabilities for instant updates
- Using Next.js App Router for optimal SEO on share pages
- Minimal external dependencies (no new packages required)
- Progressive enhancement approach (basic → enhanced features)

Estimated implementation time: 4-6 hours for an experienced developer familiar with the codebase.