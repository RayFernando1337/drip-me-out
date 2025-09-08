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

## Notes for Agents

- Do not introduce new directories or naming schemes without approval
- Keep edits minimal and reversible; prefer moving files and fixing links over rewriting content
- When you complete a feature move, note the destination path in your status update
