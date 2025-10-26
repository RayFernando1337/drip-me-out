# AGENTS.md - Convex Backend

Nearest agent guide for work inside /convex. For project-wide conventions, see the root [AGENTS.md](../AGENTS.md). For frontend specifics, see [app/AGENTS.md](../app/AGENTS.md).

## IMPORTANT
- Always run `bunx convex dev` while editing files here (watches, validates, syncs)

## Convex Function Syntax (REQUIRED)

```ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myFunction = query({
  args: { name: v.string() },
  returns: v.string(), // never omit
  handler: async (ctx, args) => {
    return "result";
  },
});
```

## Function Types & Security
- Public API: `query`, `mutation`, `action`
- Internal only: `internalQuery`, `internalMutation`, `internalAction`
- Never expose sensitive operations as public

## Validators (MANDATORY)
- Always include `args` and `returns`
- Use `v.null()` for void
- Use `v.id("table")` for IDs
- Use `v.int64()` (not `v.bigint()`)

## Function Calling Patterns
- Use `ctx.runQuery/api.*`, `ctx.runMutation/api.*`, `ctx.runAction/api.*`
- Use references from `api`/`internal`, not direct function calls
- For same-file calls, add an explicit return type to avoid TS circularity

## Database Query Patterns
- Never use `.filter()`; define indexes and use `.withIndex()`
- Use `.unique()` for single-document fetch (throws if multiple)
- Queries don’t support `.delete()`; collect then loop with `ctx.db.delete(_id)`
- Default order: ascending `_creationTime`; specify `.order("desc")` when needed

## Schema Design (`schema.ts`)
- Define with `defineSchema`/`defineTable`
- System fields are implicit: `_id`, `_creationTime`
- Index naming: include all fields (e.g., `by_user_and_status`)
- Query index fields in the order defined

## Actions
- Add `"use node";` when using Node modules
- Actions have no DB access; use `ctx.runQuery`/`ctx.runMutation`
- Use for external API calls and heavy computation

## File Storage
- `ctx.storage.getUrl(id)` for signed URLs
- Query `_storage` via `ctx.db.system.get(id)` for metadata
- Storage values are `Blob`s; convert to/from `Blob`

## TypeScript
- Use `Id<"table">` and `Doc<"table">` from `_generated/dataModel`
- Prefer type inference from validators and function returns
- Use type predicates for filtering to preserve type safety

```ts
const withUrls = await Promise.all(images.map(async (img) => ({
  ...img,
  url: await ctx.storage.getUrl(img.body),
})));

return withUrls.filter(
  (image): image is typeof image & { url: string } => image.url !== null
);
```

## Background Jobs
```ts
await ctx.scheduler.runAfter(0, internal.generate.processImage, { imageId });
```

## HTTP endpoints (convex/http.ts)
```ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();
http.route({
  path: "/echo",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.bytes();
    return new Response(body, { status: 200 });
  }),
});
export default http;
```

## Cron scheduling
```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const empty = internalAction({ args: {}, returns: v.null(), handler: async () => null });

const crons = cronJobs();
crons.interval("cleanup", { hours: 2 }, internal.crons.empty, {});
export default crons;
```

## Search indexes
```ts
const messages = await ctx.db
  .query("messages")
  .withSearchIndex("search_body", (q) => q.search("body", "hello hi").eq("channel", "#general"))
  .take(10);
```

## Pagination
```ts
import { paginationOptsValidator } from "convex/server";
export const listItems = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => ctx.db.query("items").order("desc").paginate(args.paginationOpts),
});
```

## Project-Specific Functions
- `images.ts`: Image CRUD operations with status tracking
- `generate.ts`: AI generation with Gemini API
- `schema.ts`: Images table with generation status

## Environment Variables
- Set via Convex dashboard: `GEMINI_API_KEY`

## After Changes
- Keep `bunx convex dev` open; fix errors it reports
- Validate function registration and schema changes

## Stacked Diffs for Convex Changes

When making complex Convex changes, use stacked diffs (see root [AGENTS.md](../AGENTS.md#git-workflow-stacked-diffs-with-graphite)).

### Recommended Stack Order

1. **Feature flag / config guard** – Introduce Convex-stored toggles or guard clauses (default OFF) so later branches remain safe to deploy.
2. **Schema** – Add optional fields, indexes, or tables; avoid breaking existing documents.
3. **Mutations / Actions** – Write paths that populate new data while respecting the disabled flag.
4. **Queries** – Surface the new data but handle missing fields when the flag is OFF.
5. **Migration** – Backfill or cleanup once the stack is validated.
6. **Flag flip / cleanup** – Final branch to enable the new behavior or remove guards after preview validation.

### Example: Adding User Preferences

```bash
# Introduce feature toggle document / guard
gt create --all --message "feat(convex): scaffold user preferences flag"

# Add schema updates (optional fields + indexes)
gt create --all --message "feat(schema): add user preferences fields"

# Implement write path behind the flag
gt create --all --message "feat(convex): add user preferences mutations"

# Expose read endpoint that tolerates missing data
gt create --all --message "feat(convex): add user preferences queries"

# (Optional) Hydrate historical data
gt create --all --message "feat(convex): backfill user preferences"

# Submit the entire stack
gt submit --stack --no-interactive
```

### Critical Rules for Stacked Convex Changes

- **Always keep `bunx convex dev` running** while editing
- **Test each layer** via Convex dashboard before creating next branch
- **Start with flags/guards** so intermediate branches ship safely.
- **Schema changes next** - Functions can't reference fields that don't exist
- **Use optional fields** - Prevents breaking existing data during deployment
- **Include full validators** - Each function must have args + returns defined

### Validation Per Stack Layer

```bash
# After each commit in the stack
bunx convex dev          # Verifies schema, registers functions
# Check dashboard for errors
# Test new functions in dashboard console
```
