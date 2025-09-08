# AGENTS.md - Components (React & UI)

Nearest agent guide for work inside /components. For project-wide conventions, see the root [AGENTS.md](../AGENTS.md). For Next.js app specifics, see [app/AGENTS.md](../app/AGENTS.md).

## Scope
- Directory: /components and /components/ui
- Tech: React 19, TypeScript, Tailwind v4, shadcn/ui (Radix UI)

## Component Conventions

### File Naming
- PascalCase for components: `ImagePreview.tsx`, `Webcam.tsx`
- Lowercase for utils/hooks: `use-toast.ts`
- Group related components in subdirectories

### Type Safety with Convex (CRITICAL)

```ts
"use client"; // Only if using hooks or browser APIs
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";

// Infer types from Convex queries
type ImageFromQuery = NonNullable<
  ReturnType<typeof useQuery<typeof api.images.getImages>>
>[number];

interface ImagePreviewProps {
  images?: ImageFromQuery[];
  onLoadMore?: () => void;
}

export function ImagePreview({ images = [], onLoadMore }: ImagePreviewProps) {
  return <div>...</div>;
}
```

Never create manual type compositions like `Doc<"images"> & { url: string }`.

## shadcn/ui Components (/components/ui)
- Import from `@/components/ui/[component]`
- Do not modify generated primitives directly
- Use `cn()` for className merging
- Common: Button, Card, Dialog, Avatar, Tabs, Progress, Carousel, Toaster

## State Management Patterns

```ts
"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function Component() {
  const imagesData = useQuery(api.images.getImages);
  const images = useMemo(() => imagesData || [], [imagesData]);

  const [selected, setSelected] = useState<typeof images[number] | null>(null);
  const updateSettings = useMutation(api.images.updateShareSettings);

  const handleUpdate = async (imageId: Id<"images">) => {
    await updateSettings({ imageId, sharingEnabled: true });
  };
}
```

## Styling Rules
- Tailwind v4 utilities; responsive: `sm:`, `md:`, `lg:`
- Prefer CVA for variants when useful
- Avoid inline styles

## Performance
- Mark components as "use client" only when necessary
- Prefer server components in /app; keep UI components focused and lightweight
- Lazy-load heavy components with `dynamic()`

## Error Handling
```ts
try {
  await someAction();
  toast.success("Success!");
} catch (error) {
  toast.error("Something went wrong");
  console.error(error);
}
```

## Accessibility
- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Manage focus in modals

## Testing Components
- Typecheck: `bun run build`
- Run app and verify: `bun run dev`
- Test responsive behavior and Convex integrations
