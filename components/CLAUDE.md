# CLAUDE.md - React Components

This file provides component-specific guidance for Claude Code when working in the /components directory.

## Component Conventions

### File Naming
- PascalCase for component files: `ImagePreview.tsx`, `Webcam.tsx`
- Lowercase for utility/hook files: `use-toast.ts`
- Group related components in subdirectories

### Component Structure
```typescript
"use client";  // Only if using hooks or browser APIs

import { ComponentProps } from "react";

interface MyComponentProps {
  // Define props with TypeScript interfaces
}

export function MyComponent({ prop1, prop2 }: MyComponentProps) {
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

### With Convex
```typescript
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export function Component() {
  // Real-time data
  const images = useQuery(api.images.getImages) || [];
  
  // Mutations
  const createImage = useMutation(api.images.createImage);
  
  // Handle actions
  const handleSubmit = async () => {
    await createImage({ data: "..." });
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

## Image Sharing Feature Components (In Development)
See `/documentation/image-sharing-feature-spec.md` for complete implementation details.

### New Components to be Added:

#### ImageModal.tsx (Phase 1)
- Full-screen modal for viewing individual images
- Uses shadcn/ui Dialog component (already installed)
- Features: Copy share link, social sharing, privacy settings
- Props: `image`, `isOpen`, `onClose`
- Implements keyboard navigation (ESC to close)

### Component Installation:
```bash
# Install any missing shadcn/ui components
bunx shadcn@latest add dialog   # Should already be installed
bunx shadcn@latest add switch   # For privacy toggles (Phase 4)
bunx shadcn@latest add select   # Should already be installed
```

### Modified Components:
- **ImagePreview.tsx**: Add click handler to open ImageModal (lines 66-108)
- Add state management for selected image
- Pass image data to modal component

## IMPORTANT Component Rules
- NEVER add API keys or secrets to components
- Keep components focused on single responsibility
- Use TypeScript for all props
- Handle loading and error states
- Make components reusable when possible
- Refer to `/documentation/image-sharing-feature-spec.md` for implementation details