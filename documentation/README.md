# Documentation Structure

This directory contains all project documentation following a standardized structure for AI agent consumption and human review.

## Directory Organization

```
documentation/
├── README.md                    # This file - documentation standards
├── features/                    # Feature documentation
│   ├── active/                 # Currently in-progress features
│   │   ├── [feature-name]-spec.md     # Technical specification
│   │   └── [feature-name]-progress.md # Implementation progress tracker
│   ├── completed/              # Shipped features
│   │   └── [feature-name]/    # Archived feature documentation
│   └── planned/                # Future features
│       └── [feature-name]-spec.md     # Planned specifications
└── architecture/               # System architecture docs (if needed)
```

## Documentation Standards

### For Active Features

Each active feature should have two files:
1. **`[feature-name]-spec.md`** - Technical specification
2. **`[feature-name]-progress.md`** - Progress tracking

### Naming Conventions

- Use kebab-case for file names: `image-sharing-spec.md`
- Spec files end with `-spec.md`
- Progress files end with `-progress.md`
- Keep names descriptive but concise

### Feature Lifecycle

1. **Planning**: Feature starts in `/planned` with a spec
2. **Active Development**: Move to `/active` and add progress file
3. **Completion**: Move entire feature to `/completed/[feature-name]/`

### AI Agent Context

When Claude or other AI agents work on the project:
- They should check `/features/active/` for current work
- Look for matching `-progress.md` files to understand status
- Reference completed features in `/features/completed/` for patterns

### Spec File Template

```markdown
# [Feature Name] Technical Specification

**Document Name:** [Feature] Implementation Plan  
**Date:** [Date]  
**Version:** [Version]  
**Status:** Planning | Active | Complete

## Executive Summary
Brief overview of the feature and its purpose.

## Architecture Overview
Technical architecture and integration points.

## Implementation Phases
Break down into logical phases if complex.

## Testing & Verification
Test criteria and verification steps.

## Security Considerations
Any security implications or requirements.
```

### Progress File Template

```markdown
# [Feature Name] - Implementation Progress Tracker

**Last Updated:** [Date]  
**Specification:** Link to spec file

## Overview
Brief description of implementation status.

## Phase Completion Summary
| Phase | Status | Completion | Notes |
|-------|--------|------------|-------|
| Phase 1 | ⏸️ ✅ | 0-100% | Details |

## Current Tasks
- [ ] Task 1
- [x] Completed task

## Next Steps
What needs to be done next.

## Blockers/Issues
Any current blockers or issues.
```

## CLAUDE.md Integration

The main `/CLAUDE.md` file should reference this documentation structure but NOT contain feature-specific details. Instead, it should point AI agents to:
- Check `/documentation/features/active/` for current work
- Use the documentation structure for understanding project features
- Follow the patterns established in completed features

This keeps CLAUDE.md files stable and focused on coding patterns while feature documentation remains dynamic.

## Recent Changes

- Unified image upload pipeline for webcam and file uploads. Both flows now:
  - Upload to Convex Storage via signed URL
  - Call `convex/generate.scheduleImageGeneration` which validates type/size, creates an original with `generationStatus: "pending"`, and schedules `internal.generate.generateImage`
  - Update status reactively from `pending` → `processing` → `completed`/`failed`
- Frontend uses a shared helper `lib/uploadAndSchedule.ts` to avoid duplication.
- HTTP endpoint `/sendImage` now stores file and calls `scheduleImageGeneration`, returning JSON `{ storageId, originalImageId }`.