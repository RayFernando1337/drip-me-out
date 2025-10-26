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
gt ls              # Alias for gt log short

# Create a new branch with changes in one command
gt create --all --message "feat: add schema fields"
# This stages all changes, creates a branch, and commits in one step

# Create next branch in stack (builds on current)
gt create --all --message "feat: add queries for new fields"
# Automatically stacks on the current branch

# Update current branch with new changes
gt modify --all    # Stages changes, amends commit, auto-restacks descendants
# Or to add a new commit instead of amending:
gt modify --commit --all --message "fix: address review feedback"

# Navigate the stack
gt up              # Move to parent branch (upstack)
gt down            # Move to child branch (downstack)
gt top             # Jump to top of stack
gt bottom          # Jump to base of stack

# Submit entire stack as PRs
gt submit --stack --no-interactive
# Creates/updates PRs for all branches in stack

# Update and resubmit after making changes
gt modify --all
gt submit --stack --no-interactive

# Rebase stack when main updates
gt sync            # Fetch latest main, rebase all stacks, offer to delete merged branches
```

### Stacked Diff Strategy

When implementing a feature, break it into layers that keep every PR deployable:

1. **Feature flag / configuration** – Introduce guarded code paths or config toggles (default OFF) so downstream branches can ship safely.
2. **Schema / Types** – Add optional fields or types behind the flag; avoid breaking existing data.
3. **Backend writes** – Mutations, actions, schedulers that populate the new fields while respecting the disabled flag.
4. **Backend reads / APIs** – Queries or HTTP endpoints that surface the new data but gracefully handle the flag OFF state.
5. **Frontend** – UI hooked up to the guarded API; ensure it no-ops while the flag remains OFF.
6. **Migration / Backfill** – One-off jobs to hydrate legacy data once the stack is ready.
7. **Flag flip / cleanup** – Final branch that enables the feature (or removes guards) after the stack has been validated on a release preview branch.

**Example stack:**
```
main
 ↓
feat/user-settings-flag          (introduce feature toggle + defaults)
 ↓
feat/user-settings-schema        (add optional fields, indexes)
 ↓
feat/user-settings-mutations     (write new preferences behind flag)
 ↓
feat/user-settings-queries       (read preferences, tolerate missing)
 ↓
feat/user-settings-ui            (settings page hidden behind flag)
 ↓
feat/user-settings-migration     (backfill existing users)
 ↓
feat/user-settings-launch        (flip flag ON / remove guards)
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

1. **Start with flags/guards** so schema and functions stay dormant until launch.
2. **Add schema** next; keep new fields optional and default-safe.
3. **Implement mutations/actions** behind the flag, then expose queries/APIs that tolerate missing data.
4. **Keep `bunx convex dev` running** to catch validator/index issues immediately.
5. **Test each layer** via the Convex dashboard before moving to the next branch.

### Stack Submission Workflow

```bash
# From any branch in your stack
gt submit --stack --no-interactive

# This will:
# 1. Push all branches in the stack to GitHub
# 2. Create/update PRs for each branch
# 3. Set correct base branches (each PR targets its parent)
# 4. Return URLs for all created PRs

# Note: gt stack submit is deprecated, use gt submit --stack instead
```

### Example: Real Stack from This Project

See `documentation/features/active/admin-review-workflow-stack-plan.md` for a complete example of breaking the admin review feature into 7 stacked diffs.

### Recovery Commands

```bash
# If stack gets messy
gt sync                  # Rebase everything onto latest trunk
gt restack               # Rebase current branch and descendants

# If you need to modify a middle branch
gt checkout feat/middle-branch
# Make changes
gt modify --all                          # Amend and auto-restack descendants
gt submit --stack --no-interactive       # Update all affected PRs

# Or to add a new commit instead of amending
gt modify --commit --all --message "fix: address feedback"
gt submit --stack --no-interactive
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
