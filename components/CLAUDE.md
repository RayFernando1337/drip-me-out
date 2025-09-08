# CLAUDE.md - React Components

Note: For agents, prefer [components/AGENTS.md](./AGENTS.md) for the nearest rules. The root [../AGENTS.md](../AGENTS.md) provides the project overview.

This file provides component-specific guidance for Claude Code when working in the /components directory.

## Component Conventions

### File Naming
- PascalCase for component files: `ImagePreview.tsx`, `Webcam.tsx`
- Lowercase for utility/hook files: `use-toast.ts`
- Group related components in subdirectories

### Component Structure

⚠️ **CRITICAL: Type Safety with Convex**

**❌ NEVER define manual types for Convex data:**
```typescript
// WRONG - Don't create manual type compositions
interface ImagePreviewProps {
  images: (Doc<"images"> & { url: string })[];  // ❌ Never do this
}
```

**✅ ALWAYS use type inference:**
```typescript
"use client";  // Only if using hooks or browser APIs

import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

// Infer types from Convex queries
type ImageFromQuery = NonNullable<
  ReturnType<typeof useQuery<typeof api.images.getImages>>
>[number];

interface ImagePreviewProps {
  images?: ImageFromQuery[];  // ✅ Use inferred types
  onLoadMore?: () => void;
}

export function ImagePreview({ images = [], onLoadMore }: ImagePreviewProps) {
  // Component logic
  return <div>...</div>;
}
```

## shadcn/ui Components (/components/ui)
- Pre-built Radix UI primitives with Tailwind styling
- DO NOT modify directly - they're meant to be copied/customized
- Import from `@/components/ui/[component]`
- Use `cn()` utility for className merging

### Common UI Components Available
- `Button`, `Card`, `Dialog`, `Avatar`
- `Tabs`, `Progress`, `Carousel`
- `Toaster` (via sonner integration)

## Project-Specific Components

### Webcam.tsx
- Handles camera capture and photo taking
- Converts captured images to base64
- Manages camera permissions and errors

### ImagePreview.tsx
- Displays image gallery with generation status
- Shows loading states during AI processing
- Real-time updates via Convex queries

### ConvexShowcase.tsx
- Demonstrates Convex features
- Educational component for users

### ConvexFloatingBubble.tsx
- Animated UI element
- Powered by Convex branding

## State Management Patterns

### With Convex - Type-Safe Patterns

**❌ WRONG Pattern:**
```typescript
// Creates unstable reference, causes React warnings
const images = useQuery(api.images.getImages) || [];
```

**✅ CORRECT Pattern:**
```typescript
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useState } from "react";
import { Id } from "@/convex/_generated/dataModel";

export function Component() {
  // Stable real-time data reference
  const imagesData = useQuery(api.images.getImages);
  const images = useMemo(() => imagesData || [], [imagesData]);
  
  // Type-safe local state
  const [selectedImage, setSelectedImage] = useState<typeof images[number] | null>(null);
  
  // Mutations with proper ID types
  const updateSettings = useMutation(api.images.updateShareSettings);
  
  // Handle actions with ID type safety
  const handleUpdate = async (imageId: Id<"images">) => {
    await updateSettings({ 
      imageId,  // Type-safe ID
      sharingEnabled: true 
    });
  };
}
```

### Local State
- Use `useState` for UI-only state (modals, forms)
- Use `useEffect` sparingly - prefer event handlers
- Keep state as close to usage as possible

## Styling Rules

### Tailwind Classes
- Use utility classes directly
- Group related styles with component variants
- Responsive design: `sm:`, `md:`, `lg:` prefixes

### Class Variance Authority (CVA)
```typescript
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "variant-classes",
        destructive: "other-classes",
      },
    },
  }
);
```

### Dark Mode
- Use CSS variables from globals.css
- Classes: `dark:bg-gray-900` for dark mode specific styles

## Performance Best Practices

### Component Optimization
- Mark as `"use client"` only when needed
- Server Components by default for better performance
- Lazy load heavy components with `dynamic()`

### Image Optimization
- Use Next.js `Image` component when possible
- Handle loading states for better UX
- Optimize file sizes before upload

## Error Handling
```typescript
try {
  await someAction();
  toast.success("Success!");
} catch (error) {
  toast.error("Something went wrong");
  console.error(error);
}
```

## Accessibility
- Semantic HTML elements
- ARIA labels where needed
- Keyboard navigation support
- Focus management in modals

## Testing Components
When modifying components:
1. Check TypeScript: `bun run build`
2. Test in browser: `bun run dev`
3. Verify Convex integration works
4. Test responsive design


## IMPORTANT Component Rules
- NEVER add API keys or secrets to components
- Keep components focused on single responsibility
- Use TypeScript for all props
- Handle loading and error states
- Make components reusable when possible
- Check `/documentation/features/active/` for current feature work
- Reference `/documentation/features/completed/` for implementation patterns