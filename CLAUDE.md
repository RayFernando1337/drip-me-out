# CLAUDE.md

Note: For agents, prefer the local AGENTS.md files. See the root overview in [AGENTS.md](./AGENTS.md) and the per-folder guides: [app/AGENTS.md](./app/AGENTS.md), [components/AGENTS.md](./components/AGENTS.md), [convex/AGENTS.md](./convex/AGENTS.md).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Drip Me Out is an AI-powered image transformation app that adds diamond chains to photos using Google's Gemini 2.5 Flash model. Built with Next.js 15 and powered by Convex's real-time backend platform.

## Development Commands

### Core Development
```bash
# Start development server with Turbopack
bun run dev

# Build the application
bun run build

# Start production server
bun run start

# Run linting
bun run lint
```

### Convex Backend
```bash
# Start Convex development (watches for changes)
bunx convex dev

# View logs
bunx convex logs

# Open dashboard
bunx convex dashboard

# IMPORTANT: Never use `bunx convex deploy` - this deploys to production
# Only use `bunx convex dev` for development
```

### Important: Auto-restart Convex on changes
When making changes to files in the `/convex` directory, always run `bunx convex dev` in the background to watch for errors and ensure changes are properly synced.

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI based)
- **Backend**: Convex (real-time database, file storage, background jobs)
- **AI Integration**: Google Gemini 2.5 Flash for image processing

### Key Architectural Patterns

1. **Real-Time Reactive Queries**: All data fetching uses Convex's `useQuery` hook which automatically updates when backend data changes
2. **Background Job Processing**: AI image generation runs via Convex scheduler to keep the app responsive
3. **File Storage**: Images are stored in Convex Storage with direct upload URLs
4. **Type Safety**: End-to-end TypeScript with generated Convex client types in `convex/_generated/`

### Directory Structure

- `/app`: Next.js App Router pages and layouts
- `/components`: React components including UI primitives in `/components/ui`
- `/convex`: Backend functions (queries, mutations, actions, schema)
- `/lib`: Utility functions and shared helpers

### Core Backend Functions

- **images.ts**: CRUD operations for image records
- **generate.ts**: AI image generation logic using Gemini API
- **schema.ts**: Database schema definitions with indexes

### Important Implementation Details

1. **Image Processing Flow**:
   - User uploads/captures image → Stored in Convex Storage
   - Database record created with `generationStatus: "pending"`
   - Background job scheduled via `ctx.scheduler.runAfter()`
   - AI processes image and updates status to "completed" or "failed"
   - Frontend auto-updates via reactive queries

2. **Status Tracking**: Images have `generationStatus` field that tracks: "pending" → "processing" → "completed"/"failed"

3. **Path Aliases**: Uses `@/*` for imports (configured in tsconfig.json)

4. **Environment Variables Required**:
   - `CONVEX_DEPLOYMENT`: Convex deployment URL
   - `GEMINI_API_KEY`: Google Gemini API key (set via Convex dashboard)

## Critical Type Safety Rules for Convex

### The Zen of Convex - Core Philosophy
- **Performance**: Keep functions under 100ms, work with few hundred records max
- **Reactivity**: Use queries for almost all reads - they're reactive, cacheable, consistent
- **Simplicity**: Let Convex handle caching & consistency, avoid complex local state
- **Actions**: Use sparingly, record progress incrementally, chain with mutations

### ⚠️ Type Safety Best Practices
**AVOID Manual Type Compositions:**
```typescript
// ❌ Avoid - Can drift from actual return types
type ImageWithUrl = Doc<"images"> & { url: string };
```

**USE Type Inference:**
```typescript
// ✅ Recommended - Type inference from validators
import { FunctionReturnType } from "convex/server";
type QueryResult = FunctionReturnType<typeof api.images.getImages>;

// ✅ Or infer from query results
type ImageFromQuery = NonNullable<ReturnType<typeof useQuery<typeof api.images.getImages>>>[number];

// ✅ Use Infer for validator types
import { Infer, v } from "convex/values";
const imageValidator = v.object({ url: v.string() });
type Image = Infer<typeof imageValidator>;
```

### Query Result Handling
**WRONG:**
```typescript
// ❌ This causes React hook dependency warnings
const images = useQuery(api.images.getImages) || [];
```

**CORRECT:**
```typescript
// ✅ Use useMemo for stable references
const imagesData = useQuery(api.images.getImages);
const images = useMemo(() => imagesData || [], [imagesData]);
```

### ID Type Safety
**ALWAYS** use `Id<"tableName">` for document IDs:
```typescript
// ✅ Correct ID typing
import { Id } from "@/convex/_generated/dataModel";

interface Props {
  imageId: Id<"images">;  // Never use string
}

// ✅ Cast URL params to Id types
const { imageId } = await params;
return <Component imageId={imageId as Id<"images">} />;
```

### Validators Are CRITICAL for Security
**ALWAYS** include argument and return validators in public Convex functions:
```typescript
// ✅ Secure & Type-Safe
export const getImages = query({
  args: {},  // Always include args, even if empty
  returns: v.array(v.object({
    _id: v.id("images"),
    url: v.string(),
    // ... define ALL fields
  })),
  handler: async (ctx) => { /* ... */ }
});
```

**Why Validators Are Non-Negotiable:**
- **Security**: Public functions can be called by anyone - validators prevent attacks
- **Type Safety**: Automatic TypeScript type inference from validators
- **Runtime Safety**: TypeScript types don't exist at runtime - validators do
- **API Contract**: Validators document and enforce your API

### Type Predicate for Filtering
When filtering arrays with nullable values:
```typescript
// ✅ Use type predicates for proper type narrowing
return imagesWithUrls.filter(
  (image): image is typeof image & { url: string } => image.url !== null
);
```

## Documentation Structure

Project documentation follows a standardized structure in `/documentation/`:

### Feature Documentation
- **Active Features**: `/documentation/features/active/` - Currently in development
- **Completed Features**: `/documentation/features/completed/` - Shipped features
- **Planned Features**: `/documentation/features/planned/` - Future roadmap

### Working with Features
When working on features:
1. Check `/documentation/features/active/` for current work
2. Look for `[feature-name]-spec.md` for technical specifications
3. Track progress in `[feature-name]-progress.md`
4. Reference completed features for implementation patterns

See `/documentation/README.md` for documentation standards and templates.