# CLAUDE.md - Next.js App Router

This file provides Next.js App Router specific guidance for Claude Code when working in the /app directory.

## Next.js 15 App Router Conventions

### File Structure
- `page.tsx`: Page component (defines a route)
- `layout.tsx`: Shared layout wrapper
- `loading.tsx`: Loading UI
- `error.tsx`: Error boundary
- `not-found.tsx`: 404 page
- `route.ts`: API route handler

### Page Component Rules
- MUST be default export
- Use `"use client"` directive for client components
- Server Components by default (no `"use client"` needed)

## Convex Integration with Next.js

### ⚠️ CRITICAL: Type-Safe Query Patterns

**❌ NEVER do this:**
```typescript
// Wrong - creates unstable references
const images = useQuery(api.images.getImages) || [];

// Wrong - manual type composition
type ImageWithUrl = Doc<"images"> & { url: string };
```

**✅ ALWAYS do this:**
```typescript
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";

export default function Component() {
  // Stable query result handling
  const imagesData = useQuery(api.images.getImages);
  const images = useMemo(() => imagesData || [], [imagesData]);
  
  // Type inference from query
  const [displayedImages, setDisplayedImages] = useState<typeof images>([]);
  
  // Mutations
  const mutate = useMutation(api.images.createImage);
}
```

### Type Inference Patterns
```typescript
// ✅ Infer types from query return values
type ImageFromQuery = NonNullable<
  ReturnType<typeof useQuery<typeof api.images.getImages>>
>[number];

// ✅ Use typeof for array types
const [items, setItems] = useState<typeof images>([]);

// ✅ Cast URL params to Id types
import { Id } from "@/convex/_generated/dataModel";
const { imageId } = await params;
return <Component imageId={imageId as Id<"images">} />;
```

### Real-Time Updates
- `useQuery` hooks automatically re-render on data changes
- No need for manual refresh or polling
- Use `useMemo` for stable references to avoid React warnings

## Project-Specific Patterns

### Main Page Structure
- Upload/capture controls
- Real-time image gallery with status tracking
- Loading states for AI processing

### Convex Provider Setup
- Wrapped in `provider.tsx` with ConvexReactClient
- Environment variable: `NEXT_PUBLIC_CONVEX_URL`

## Styling Conventions
- Tailwind CSS v4 with utility classes
- Dark mode support via `next-themes`
- Use `cn()` utility for conditional classes
- Avoid inline styles

## Image Handling
- Base64 conversion for AI processing
- Direct upload to Convex Storage
- Status tracking: pending → processing → completed/failed

## Performance Optimizations
- Turbopack enabled (`--turbopack` flag)
- Minimize client bundle with server components
- Lazy load heavy components

## TypeScript
- Strict mode enabled
- Use path alias: `@/*` maps to project root
- Type imports from `@/convex/_generated/dataModel`

## Testing UI Changes
```bash
bun run dev  # Development server on localhost:3000
```

## Common Patterns

### File Upload
```typescript
const uploadUrl = await generateUploadUrl();
const response = await fetch(uploadUrl, {
  method: "POST",
  body: file,
});
```

### Status Checking
```typescript
const isProcessing = images.some(
  img => img.generationStatus === 'pending' || 
        img.generationStatus === 'processing'
);
```

## IMPORTANT
- Never expose API keys in client code
- Use server actions or API routes for sensitive operations
- Keep components focused and composable
- Check `/documentation/features/active/` for current feature work
- Reference `/documentation/features/completed/` for implementation patterns