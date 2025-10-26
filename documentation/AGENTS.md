# AGENTS.md (Documentation)

This file defines how AI coding agents and contributors should manage the documentation workspace, with a focus on feature lifecycle docs under `/documentation/features`.

## Purpose

- Keep feature docs predictable for agents and humans
- Make active work discoverable and completed work archivable
- Avoid stale links when features move through their lifecycle

## Read This First

- Standards and templates live in [README.md](./README.md)
- Follow "closest-wins": prefer rules in this file for documentation tasks

## Feature Docs Lifecycle

A feature moves through three stages. Maintain structure and naming throughout.

1. Planning
   - Location: `/documentation/features/planned/`
   - File: `[feature-name]-spec.md` (spec only)
2. Active development
   - Move spec to: `/documentation/features/active/`
   - Add: `[feature-name]-progress.md`
3. Completion (ship)
   - Create folder: `/documentation/features/completed/[feature-name]/`
   - Move both files into that folder (keep original filenames)
   - Validate internal links (spec/progress cross-links)

## Naming Conventions

- Kebab-case filenames, e.g. `image-sharing-spec.md`
- Specs end with `-spec.md`
- Progress trackers end with `-progress.md`
- Match the feature folder name under `completed/`

## Move Checklist (agent-ready)

- [ ] Create `/documentation/features/completed/[feature-name]/`
- [ ] Move `*-spec.md` and `*-progress.md` from `active/` into the completed folder
- [ ] Update intra-doc links if they used relative paths
- [ ] Search the repo for references pointing to `documentation/features/active/[feature-name]` and update if needed
- [ ] Verify structure matches [README.md](./README.md)

## What To Index / Where To Look

- Current work: `/documentation/features/active/`
- Completed patterns: `/documentation/features/completed/`
- Future work: `/documentation/features/planned/`

## Summary Files Policy

**CRITICAL:** Never create summary/implementation files in the project root (`/`).

All summary documents must go in:

- `/documentation/fixes/` for bug fixes and improvements
- `/documentation/features/completed/[feature-name]/` for feature summaries
- `/documentation/features/active/` for in-progress summaries

Examples of prohibited root files:

- ❌ `/SUMMARY.md`
- ❌ `/IMPLEMENTATION-SUMMARY.md`
- ❌ `/REBRAND-SUMMARY.md`
- ❌ Any `*-SUMMARY.md` or `SUMMARY-*.md` in root

See [README.md](./README.md#summary-files--reports) for full policy.

## Notes for Agents

- Do not introduce new directories or naming schemes without approval
- Keep edits minimal and reversible; prefer moving files and fixing links over rewriting content
- When you complete a feature move, note the destination path in your status update
- **Always place summary files in `/documentation/` subdirectories, never in root**

## Documenting Stacked Diffs

When a feature uses stacked diffs (Graphite), document the stack plan:

### Stack Plan Template

Create `[feature-name]-stack-plan.md` in `/documentation/features/active/`:

```markdown
# [Feature Name] - Stacked Diff Plan

## Overview
Brief description of feature and why it needs stacking.

## Stack Structure
```
main
 ↓
1. feat/feature-schema (description)
 ↓
2. feat/feature-queries (description)
 ↓
...
```

## Per-Stack Documentation

For each branch in the stack:

### Stack N: [Branch Name]
**Branch:** `feat/branch-name`  
**Parent:** `feat/parent-branch`  
**Description:** What this branch changes

#### Changes:
- File 1: what changed
- File 2: what changed

#### Testing:
```bash
# Commands to verify this layer works
```

#### Commit message:
```
type(scope): short description

- Bullet point details
```

### Execution Commands

Full bash script showing gt commands to create the stack.

Example:
```bash
# Create first branch with changes
gt create --all --message "feat(schema): add feature fields"

# Create second branch stacked on first
gt create --all --message "feat(convex): add feature queries"

# Continue stacking...
gt create --all --message "feat(ui): add feature UI"

# Submit entire stack
gt submit --stack --no-interactive
```

To update a branch in the stack:
```bash
# Checkout the branch to update
gt checkout feat/branch-name

# Make changes, then amend and auto-restack
gt modify --all

# Submit updated stack
gt submit --stack --no-interactive
```

### Example Stack Plan

See `/documentation/features/active/admin-review-workflow-stack-plan.md` for complete reference.

### When to Create Stack Plans

- Feature requires 3+ dependent PRs
- Complex changes spanning backend + frontend
- Breaking changes that need careful sequencing
- Migration/backfill required after deployment

### Stack Plan Location

- Planning: `/documentation/features/planned/[feature-name]-stack-plan.md`
- Active: `/documentation/features/active/[feature-name]-stack-plan.md`
- Completed: Move to `/documentation/features/completed/[feature-name]/[feature-name]-stack-plan.md`
