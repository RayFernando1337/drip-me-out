# CLAUDE.md - Convex Backend

This file provides Convex-specific guidance for Claude Code when working in the /convex directory.

## IMPORTANT: Always run `bunx convex dev` in background when modifying files here

## Convex Function Syntax

ALWAYS use the new function syntax with validators:
```typescript
export const myFunction = query({
  args: { name: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    return "result";
  },
});
```

## Key Convex Rules

### Function Types
- `query`, `mutation`, `action` = Public API functions
- `internalQuery`, `internalMutation`, `internalAction` = Private internal functions
- NEVER expose sensitive operations as public functions

### Function Calling
- Use `ctx.runQuery()`, `ctx.runMutation()`, `ctx.runAction()` with function references from `api` or `internal`
- NEVER pass functions directly - always use function references
- Add type annotations when calling functions in the same file to avoid TypeScript circularity

### Validators
- ALWAYS include `args` and `returns` validators
- Use `v.null()` for functions that return nothing
- Use `v.id("tableName")` for document IDs
- Use `v.int64()` not `v.bigint()` for 64-bit integers
- Arrays: `v.array(v.string())`
- Objects: `v.object({ field: v.string() })`
- Unions: `v.union(v.string(), v.number())`

### Database Queries
- NEVER use `.filter()` - define indexes and use `.withIndex()` instead
- Use `.unique()` to get a single document (throws if multiple match)
- Queries do NOT support `.delete()` - use `.collect()` then iterate with `ctx.db.delete()`
- Default order is ascending `_creationTime`

### Schema Design
- Define in `schema.ts` using `defineSchema` and `defineTable`
- System fields added automatically: `_id`, `_creationTime`
- Index naming: Include all fields (e.g., `by_channel_and_user` for `["channelId", "userId"]`)
- Query index fields in the order they're defined

### Actions
- Add `"use node";` at the top for Node.js modules
- Actions have NO database access - use `ctx.runQuery` or `ctx.runMutation`
- Use for external API calls and heavy computations

### File Storage
- Use `ctx.storage.getUrl()` for signed URLs
- Query `_storage` system table for metadata
- Convert to/from `Blob` objects

### TypeScript
- Use `Id<"tableName">` from `_generated/dataModel` for type-safe IDs
- Use `Doc<"tableName">` for document types
- Add `as const` for string literals in discriminated unions
- Define arrays as `const array: Array<T> = [...];`

## Common Patterns

### Scheduling Background Jobs
```typescript
await ctx.scheduler.runAfter(0, internal.generate.processImage, {
  imageId: newImageId,
});
```

### Pagination
```typescript
import { paginationOptsValidator } from "convex/server";

export const listItems = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("items")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
```

## Project-Specific Functions

- `images.ts`: Image CRUD operations with status tracking
- `generate.ts`: AI generation with Gemini API
- `schema.ts`: Images table with generation status

## Environment Variables
Set via Convex dashboard:
- `GEMINI_API_KEY`: Google Gemini API key


## Testing Changes
After modifying Convex functions, check the `bunx convex dev` output for:
- TypeScript errors
- Schema validation issues
- Function registration problems
- Check `/documentation/features/active/` for current feature work
- Reference `/documentation/features/completed/` for implementation patterns