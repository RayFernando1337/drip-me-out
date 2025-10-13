# AGENTS.md

This is the canonical entrypoint for AI coding agents (e.g., Amp) working in this repository. It provides a concise project overview and points to the nearest per-folder AGENTS.md files that contain the actionable, context-specific rules.

## Project Overview

Anime Leak is an AI-powered image transformation app where anime leaks into reality, transforming everyday objects into magical anime illustrations using Google's Gemini 2.5 Flash model.

- Frontend: Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- UI: shadcn/ui (Radix UI based)
- Backend: Convex (real-time database, file storage, background jobs)
- AI: Google Gemini 2.5 Flash

Directory structure:

- /app: Next.js App Router pages/layouts
- /components: React components and UI primitives in /components/ui
- /convex: Backend functions (queries, mutations, actions, schema)
- /lib: Utilities and shared helpers

## Development Commands

Use bun for scripts and bunx for Convex CLI.

```bash
bun run dev      # Start dev server with Turbopack
bun run build    # Typecheck + build
bun run start    # Start production server
bun run lint     # ESLint

# Convex backend (always run while editing /convex)
bunx convex dev          # Watches for changes, validates, syncs
bunx convex logs         # Display logs
bunx convex dashboard    # Open dashboard

# IMPORTANT: NEVER run `bunx convex deploy` from local dev
```

Environment variables:

- NEXT_PUBLIC_CONVEX_URL (frontend)
- CONVEX_DEPLOYMENT (optional, deployment URL)
- GEMINI_API_KEY (Convex dashboard)

## Verification Gates

- Typecheck: bun run build
- Lint: bun run lint
- Tests: (none yet; skip)
- Build: bun run build

## Use the Nearest AGENTS.md (closest-wins)

To keep agent context minimal, each major folder has its own AGENTS.md. Agents should read the nearest file in the directory tree first (closest wins), then fall back to this root file.

- Frontend app rules: [app/AGENTS.md](app/AGENTS.md)
- Shared components rules: [components/AGENTS.md](components/AGENTS.md)
- Convex backend rules: [convex/AGENTS.md](convex/AGENTS.md)
- Documentation rules: [documentation/AGENTS.md](documentation/AGENTS.md)

## Working With Features

- Active work: /documentation/features/active/
- Completed: /documentation/features/completed/
- Planned: /documentation/features/planned/

When implementing a feature:

- Check the active spec and progress docs
- Reuse patterns from completed features

## Notes

- The detailed per-area rules (Convex validators/indexing, Next.js App Router patterns, shadcn/ui usage, domain-specific flows) live in the subfolder AGENTS.md files linked above.
- For discovery and precedence behavior, see agents.md (closest-wins).
