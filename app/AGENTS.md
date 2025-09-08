# AGENTS.md - App (Next.js App Router)

This file is the nearest agent guide for work inside /app. Use it instead of the root AGENTS.md for app-specific rules. For project-wide conventions, see the root [AGENTS.md](../AGENTS.md).

## Scope
- Directory: /app
- Tech: Next.js 15 App Router, TypeScript, Tailwind v4
- Data: Convex via client hooks

## File Structure
- page.tsx: default-exported page component
- layout.tsx: shared layout
- loading.tsx: loading UI
- error.tsx: error boundary
- not-found.tsx: 404 page
- route.ts: API route handler

## Client vs Server Components
- Server Components by default (no "use client")
- Add "use client" only if needed for:
  - Browser APIs (camera, localStorage)
  - React hooks (useState, useEffect)
  - Event handlers
  - Convex hooks (useQuery, useMutation)

## Convex Integration (Type-Safe)

```ts
"use client";
import { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

// Stable query result handling
const imagesData = useQuery(api.images.getImages);
const images = useMemo(() => imagesData || [], [imagesData]);

// Type inference for array elements
export type ImageFromQuery = NonNullable<
  ReturnType<typeof useQuery<typeof api.images.getImages>>
>[number];
```

ID safety:

```ts
import { Id } from "@/convex/_generated/dataModel";
function onSelect(imageId: Id<"images">) {
  // ...
}
```

## Real-Time Updates
- useQuery is reactive; avoid manual polling
- Always stabilize undefined initial value with useMemo

## Project-Specific Patterns
- Main page should include:
  - Upload/capture controls
  - Real-time image gallery with generationStatus rendering
  - Loading states for AI processing

Status helpers:

```ts
const isProcessing = images.some(
  (img) => img.generationStatus === "pending" || img.generationStatus === "processing"
);
```

## Common Patterns

### File Upload
```ts
const uploadUrl = await generateUploadUrl();
const response = await fetch(uploadUrl, {
  method: "POST",
  body: file,
});
```

### Status Checking
```ts
const isProcessing = images.some(
  (img) => img.generationStatus === "pending" || img.generationStatus === "processing"
);
```

## Provider & Env
- Convex React client is provided at the app root
- Env: NEXT_PUBLIC_CONVEX_URL is required for client

## Styling
- Tailwind v4 utilities; responsive prefixes sm:/md:/lg:
- Use cn() for className merging
- Avoid inline styles; prefer variants (CVA) where needed

## Performance
- Prefer server components; mark client only when necessary
- Lazy-load heavy components via dynamic()
- Use Next.js Image where possible

## Testing UI Changes
```bash
bun run dev  # localhost:3000
```

## Do / Don’t (App)
- Do: Keep components focused; handle loading/error states
- Do: Use type inference instead of manual Doc<...> & {...}
- Don’t: Expose secrets in client code; use server routes/actions for sensitive ops
