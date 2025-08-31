# CLAUDE.md

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

## Feature Specifications

### Image Sharing Feature (In Development)
A comprehensive technical specification for implementing image sharing functionality is available at:
`/documentation/image-sharing-feature-spec.md`

This specification includes:
- Phase 1: Image Modal for viewing individual images
- Phase 2: URL generation and public share routes (`/share/[imageId]`)
- Phase 3: Social sharing (Twitter/X, native mobile)
- Phase 4: Privacy settings and link expiration

Key implementation details:
- Uses shadcn/ui components (install with `bunx shadcn@latest add [component]`)
- Leverages Convex real-time queries for instant updates
- Each phase is independently verifiable with specific test criteria
- Follows all existing CLAUDE.md patterns and conventions