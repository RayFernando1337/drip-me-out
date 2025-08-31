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

### Client Components with Convex
```typescript
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Component() {
  const data = useQuery(api.images.getImages);
  const mutate = useMutation(api.images.createImage);
  // ...
}
```

### Real-Time Updates
- `useQuery` hooks automatically re-render on data changes
- No need for manual refresh or polling
- Check for undefined during initial load: `const data = useQuery(api.endpoint) || []`

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

## Image Sharing Feature (In Development)
See `/documentation/image-sharing-feature-spec.md` for complete implementation details.

### New Routes to be Added:
- `/share/[imageId]/page.tsx` - Public share page (server component)
- `/share/[imageId]/client.tsx` - Client component for share page

### Key Implementation Notes:
- Use `preloadQuery` from `convex/nextjs` for SEO-friendly share pages
- Implement Open Graph metadata in `generateMetadata` function
- Share pages should work without authentication
- Follow the specification phases for sequential implementation

## IMPORTANT
- Never expose API keys in client code
- Use server actions or API routes for sensitive operations
- Keep components focused and composable
- Refer to `/documentation/image-sharing-feature-spec.md` for feature implementations