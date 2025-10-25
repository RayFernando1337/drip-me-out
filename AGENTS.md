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

## Git Workflow: Stacked Diffs with Graphite

This project uses **Graphite (gt CLI)** for managing stacked diffs. Break large features into small, reviewable, logically dependent PRs.

### Core Principles

- **Small PRs**: Each branch should represent one logical change (50-200 lines typically)
- **Dependencies**: Stack branches that build on each other
- **Independent review**: Each PR in the stack can be reviewed separately
- **Safe landing**: Merge branches in order without breaking main

### Common Commands

```bash
# View current stack
gt log short        # Compact view of tracked branches
gt log             # Detailed view with commit info
gt log long        # Full git graph

# Create a new branch in a stack
gt create feat/my-feature-part1
# Make changes, commit
git add .
git commit -m "feat: add schema fields"

# Create next branch in stack (builds on current)
gt create feat/my-feature-part2
# Make changes, commit
git add .
git commit -m "feat: add queries for new fields"

# Navigate the stack
gt up              # Move to parent branch (upstack)
gt down            # Move to child branch (downstack)
gt top             # Jump to top of stack
gt bottom          # Jump to base of stack

# Submit entire stack as PRs
gt stack submit    # Creates/updates PRs for all branches in stack

# Rebase stack when main updates
gt sync            # Fetch latest main
gt stack restack   # Rebase entire stack onto main
```

### Stacked Diff Strategy

When implementing a feature, break it into layers:

1. **Schema/Types** - Non-breaking database/type changes
2. **Backend reads** - Queries that use new schema (read-only, safe)
3. **Backend writes** - Mutations that modify data
4. **Breaking changes** - Changes that affect existing behavior
5. **Frontend** - UI that consumes new backend functions
6. **Migration** - Backfill or cleanup (run once after deploy)

**Example stack:**
```
main
 ↓
feat/user-settings-schema        (add fields, indexes)
 ↓
feat/user-settings-queries       (read new fields)
 ↓
feat/user-settings-mutations     (update new fields)
 ↓
feat/user-settings-ui            (settings page UI)
 ↓
feat/user-settings-migration     (backfill existing users)
```

### Best Practices

- **Commit early**: Each branch should have 1-3 focused commits
- **Test independently**: Each stack layer should be testable on its own
- **Clear commit messages**: Use conventional commits (`feat:`, `fix:`, `refactor:`)
- **Descriptive branch names**: Use `feat/`, `fix/`, `refactor/` prefixes
- **Keep stacks shallow**: 3-7 branches per stack is ideal
- **Run verification**: Test after each commit (`bunx convex dev`, `bun run build`)

### Working with Convex Stacks

When stacking Convex changes:

1. **Schema first** - Deploy schema changes before functions that use them
2. **Queries before mutations** - Read operations are safer to deploy first
3. **Keep `bunx convex dev` running** - Catches errors immediately
4. **Test each layer** - Use Convex dashboard to verify functions work

### Stack Submission Workflow

```bash
# From any branch in your stack
gt stack submit

# This will:
# 1. Push all branches in the stack to GitHub
# 2. Create/update PRs for each branch
# 3. Set correct base branches (each PR targets its parent)
# 4. Return URLs for all created PRs
```

### Example: Real Stack from This Project

See `documentation/features/active/admin-review-workflow-stack-plan.md` for a complete example of breaking the admin review feature into 7 stacked diffs.

### Recovery Commands

```bash
# If stack gets messy
gt stack restack          # Rebase everything onto correct parents

# If you need to modify a middle branch
gt checkout feat/middle-branch
# Make changes
git add .
git commit --amend       # Or create new commit
gt stack restack         # Reapply all downstream branches
gt stack submit          # Update all affected PRs
```

### Integration with This Project

- **Always run `bunx convex dev`** when working on backend stacks
- **Test frontend stacks** with `bun run dev`
- **Verify types** with `bun run build` before submitting
- **Document stacks** in `/documentation/features/active/` with `-stack-plan.md` suffix

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
